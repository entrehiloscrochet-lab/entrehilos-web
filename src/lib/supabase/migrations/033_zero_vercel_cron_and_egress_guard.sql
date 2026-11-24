-- ============================================================================
-- MIGRACIÓN 033: CRON 100% EN POSTGRES (0 CPU VERCEL) + GUARDIA DE EGRESS
-- Ejecutar en Supabase SQL Editor después de 031 y 032
-- ============================================================================

-- 1. PARSER DE FECHA + HORA EN ZONA HORARIA AMERICA/LIMA
--    Si hora_entrega es NULL o vacía, asume las 09:00 hora Lima.
CREATE OR REPLACE FUNCTION public.parse_delivery_ts_lima(
  p_date DATE,
  p_hora TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean TEXT;
  v_match TEXT[];
  v_h INT := 9;
  v_m INT := 0;
  v_ampm TEXT;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean := lower(
    translate(
      COALESCE(btrim(p_hora), ''),
      'áéíóúüÁÉÍÓÚÜ',
      'aeiouuAEIOUU'
    )
  );

  IF v_clean <> '' THEN
    -- 1. Formato 12h con am/pm (ej. "3:30 pm", "10am", "12:00 pm")
    v_match := regexp_match(v_clean, '(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)');
    IF v_match IS NOT NULL THEN
      v_h := v_match[1]::INT;
      v_m := COALESCE(NULLIF(v_match[2], ''), '0')::INT;
      v_ampm := v_match[3];
      IF v_h BETWEEN 1 AND 12 AND v_m BETWEEN 0 AND 59 THEN
        IF v_ampm LIKE 'p%' AND v_h < 12 THEN
          v_h := v_h + 12;
        ELSIF v_ampm LIKE 'a%' AND v_h = 12 THEN
          v_h := 0;
        END IF;
        RETURN (p_date + make_time(v_h, v_m, 0)) AT TIME ZONE 'America/Lima';
      END IF;
    END IF;

    -- 2. Formato 24h HH:MM (ej. "15:30", "14:00 - 16:00")
    v_match := regexp_match(v_clean, '(\d{1,2})\s*:\s*(\d{2})');
    IF v_match IS NOT NULL THEN
      v_h := v_match[1]::INT;
      v_m := v_match[2]::INT;
      IF v_h BETWEEN 0 AND 23 AND v_m BETWEEN 0 AND 59 THEN
        RETURN (p_date + make_time(v_h, v_m, 0)) AT TIME ZONE 'America/Lima';
      END IF;
    END IF;

    -- 3. Hora con sufijo h/hrs (ej. "14h", "16 hrs")
    v_match := regexp_match(v_clean, '\m(\d{1,2})\s*(?:h|hs|hrs)\M');
    IF v_match IS NOT NULL THEN
      v_h := v_match[1]::INT;
      v_m := 0;
      IF v_h BETWEEN 0 AND 23 THEN
        RETURN (p_date + make_time(v_h, v_m, 0)) AT TIME ZONE 'America/Lima';
      END IF;
    END IF;

    -- 4. Referencias textuales
    IF v_clean ~ '\m(mediodia|medio\s*dia)\M' THEN
      v_h := 12; v_m := 0;
    ELSIF v_clean ~ '\m(manana|temprano|am)\M' THEN
      v_h := 9; v_m := 0;
    ELSIF v_clean ~ '\m(tarde|pm)\M' THEN
      v_h := 14; v_m := 0;
    ELSIF v_clean ~ '\mnoche\M' THEN
      v_h := 19; v_m := 0;
    ELSE
      v_h := 9; v_m := 0;
    END IF;
  END IF;

  RETURN (p_date + make_time(v_h, v_m, 0)) AT TIME ZONE 'America/Lima';
END;
$$;

-- 2. FUNCIÓN DE RECORDATORIOS 24H / 2H DIRECTO EN POSTGRES (0 INVOCACIONES A VERCEL)
CREATE OR REPLACE FUNCTION public.check_upcoming_deliveries_alerts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_active_devices BIGINT := 0;
  v_checked_pedidos INT := 0;
  v_checked_pers INT := 0;
  v_sent_24h INT := 0;
  v_sent_2h INT := 0;
  v_date_lima DATE;
  v_delivery_ts TIMESTAMPTZ;
  v_mins NUMERIC;
  v_resumen TEXT;
  v_extra TEXT;
  v_tiempo TEXT;
  v_cliente TEXT;
  v_rem_mins INT;
  r_ped RECORD;
  r_pers RECORD;
BEGIN
  -- Limpieza automática de alertas mayores a 30 días para mantener la tabla ligera
  DELETE FROM public.admin_alerts
   WHERE created_at < (v_now - INTERVAL '30 days');

  SELECT COUNT(*)
    INTO v_active_devices
    FROM public.admin_alert_devices
   WHERE active = true;

  IF v_active_devices = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', 'no_active_devices',
      'checkedPedidos', 0,
      'checkedPersonalizados', 0,
      'sent24h', 0,
      'sent2h', 0
    );
  END IF;

  -- Revisar pedidos estándar
  FOR r_ped IN
    SELECT id, cliente_nombre, total, estado, fecha_entrega, hora_entrega, notified_24h_at, notified_2h_at
      FROM public.pedidos
     WHERE fecha_entrega IS NOT NULL
       AND COALESCE(lower(btrim(estado)), '') NOT IN ('entregado', 'cancelado')
       AND (notified_24h_at IS NULL OR notified_2h_at IS NULL)
  LOOP
    v_date_lima := (r_ped.fecha_entrega AT TIME ZONE 'America/Lima')::DATE;
    v_delivery_ts := public.parse_delivery_ts_lima(v_date_lima, r_ped.hora_entrega);
    IF v_delivery_ts IS NULL THEN
      CONTINUE;
    END IF;

    v_checked_pedidos := v_checked_pedidos + 1;
    v_mins := EXTRACT(EPOCH FROM (v_delivery_ts - v_now)) / 60.0;
    v_cliente := COALESCE(NULLIF(btrim(r_ped.cliente_nombre), ''), 'Cliente');
    v_resumen := to_char(v_date_lima, 'DD/MM/YYYY') || ' · ' || COALESCE(NULLIF(btrim(r_ped.hora_entrega), ''), '09:00 (ref.)');
    v_extra := CASE
      WHEN COALESCE(r_ped.total, 0) > 0 THEN ' (S/ ' || to_char(r_ped.total, 'FM999999990.00') || ')'
      ELSE ''
    END;

    IF v_mins <= 120 AND v_mins >= -30 AND r_ped.notified_2h_at IS NULL THEN
      v_rem_mins := GREATEST(0, ROUND(v_mins)::INT);
      v_tiempo := CASE
        WHEN v_mins <= 0 THEN 'ahora'
        WHEN v_rem_mins < 60 THEN 'en ' || v_rem_mins || ' min'
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_2h',
        'Entrega muy próxima (' || v_tiempo || ')',
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — ' || v_resumen,
        '/admin?seccion=pedidos&sub=pedidos',
        'pedidos',
        'pedidos',
        'eh-entrega-2h-pedidos-' || r_ped.id,
        jsonb_build_object('pedidoId', r_ped.id, 'tabla', 'pedidos', 'ventana', '2h')
      );

      UPDATE public.pedidos
         SET notified_2h_at = v_now,
             notified_24h_at = COALESCE(notified_24h_at, v_now)
       WHERE id = r_ped.id;

      v_sent_2h := v_sent_2h + 1;

    ELSIF v_mins > 120 AND v_mins <= 1440 AND r_ped.notified_24h_at IS NULL THEN
      v_rem_mins := ROUND(v_mins)::INT;
      v_tiempo := CASE
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_24h',
        'Entrega programada (' || v_tiempo || ')',
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — ' || v_resumen,
        '/admin?seccion=pedidos&sub=pedidos',
        'pedidos',
        'pedidos',
        'eh-entrega-24h-pedidos-' || r_ped.id,
        jsonb_build_object('pedidoId', r_ped.id, 'tabla', 'pedidos', 'ventana', '24h')
      );

      UPDATE public.pedidos
         SET notified_24h_at = v_now
       WHERE id = r_ped.id;

      v_sent_24h := v_sent_24h + 1;
    END IF;
  END LOOP;

  -- Revisar pedidos personalizados
  FOR r_pers IN
    SELECT id, nombre_cliente, producto_nombre, estado, fecha_entrega, hora_entrega, notified_24h_at, notified_2h_at
      FROM public.pedidos_personalizados
     WHERE fecha_entrega IS NOT NULL
       AND COALESCE(lower(btrim(estado)), '') NOT IN ('entregado', 'cancelado')
       AND (notified_24h_at IS NULL OR notified_2h_at IS NULL)
  LOOP
    v_date_lima := r_pers.fecha_entrega::DATE;
    v_delivery_ts := public.parse_delivery_ts_lima(v_date_lima, r_pers.hora_entrega);
    IF v_delivery_ts IS NULL THEN
      CONTINUE;
    END IF;

    v_checked_pers := v_checked_pers + 1;
    v_mins := EXTRACT(EPOCH FROM (v_delivery_ts - v_now)) / 60.0;
    v_cliente := COALESCE(NULLIF(btrim(r_pers.nombre_cliente), ''), 'Cliente');
    v_resumen := to_char(v_date_lima, 'DD/MM/YYYY') || ' · ' || COALESCE(NULLIF(btrim(r_pers.hora_entrega), ''), '09:00 (ref.)');
    v_extra := CASE
      WHEN NULLIF(btrim(r_pers.producto_nombre), '') IS NOT NULL THEN ' (' || btrim(r_pers.producto_nombre) || ')'
      ELSE ''
    END;

    IF v_mins <= 120 AND v_mins >= -30 AND r_pers.notified_2h_at IS NULL THEN
      v_rem_mins := GREATEST(0, ROUND(v_mins)::INT);
      v_tiempo := CASE
        WHEN v_mins <= 0 THEN 'ahora'
        WHEN v_rem_mins < 60 THEN 'en ' || v_rem_mins || ' min'
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_2h',
        'Entrega muy próxima (' || v_tiempo || ')',
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — ' || v_resumen,
        '/admin?seccion=pedidos&sub=personalizados',
        'pedidos',
        'personalizados',
        'eh-entrega-2h-pedidos_personalizados-' || r_pers.id,
        jsonb_build_object('pedidoId', r_pers.id, 'tabla', 'pedidos_personalizados', 'ventana', '2h')
      );

      UPDATE public.pedidos_personalizados
         SET notified_2h_at = v_now,
             notified_24h_at = COALESCE(notified_24h_at, v_now)
       WHERE id = r_pers.id;

      v_sent_2h := v_sent_2h + 1;

    ELSIF v_mins > 120 AND v_mins <= 1440 AND r_pers.notified_24h_at IS NULL THEN
      v_rem_mins := ROUND(v_mins)::INT;
      v_tiempo := CASE
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_24h',
        'Entrega programada (' || v_tiempo || ')',
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — ' || v_resumen,
        '/admin?seccion=pedidos&sub=personalizados',
        'pedidos',
        'personalizados',
        'eh-entrega-24h-pedidos_personalizados-' || r_pers.id,
        jsonb_build_object('pedidoId', r_pers.id, 'tabla', 'pedidos_personalizados', 'ventana', '24h')
      );

      UPDATE public.pedidos_personalizados
         SET notified_24h_at = v_now
       WHERE id = r_pers.id;

      v_sent_24h := v_sent_24h + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'checkedAt', v_now,
    'checkedPedidos', v_checked_pedidos,
    'checkedPersonalizados', v_checked_pers,
    'sent24h', v_sent_24h,
    'sent2h', v_sent_2h
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_upcoming_deliveries_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_upcoming_deliveries_alerts() TO service_role;

-- 3. REEMPLAZAR EL CRON PARA EJECUTARSE 100% EN POSTGRES (SIN HTTP A VERCEL)
CREATE OR REPLACE FUNCTION public.trigger_upcoming_deliveries_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_upcoming_deliveries_alerts();
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'entrehilos-upcoming-deliveries') THEN
      PERFORM cron.unschedule('entrehilos-upcoming-deliveries');
    END IF;
    PERFORM cron.schedule(
      'entrehilos-upcoming-deliveries',
      '*/15 * * * *',
      'SELECT public.trigger_upcoming_deliveries_cron();'
    );
  END IF;
END $$;

-- 4. OPTIMIZAR POLLING DE ALERTAS (MENOS ESCRITURAS Y PAYLOAD COMPACTO)
CREATE OR REPLACE FUNCTION public.poll_admin_alerts(
  p_device_id TEXT,
  p_device_secret TEXT,
  p_after_id BIGINT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  tipo TEXT,
  titulo TEXT,
  cuerpo TEXT,
  url TEXT,
  seccion TEXT,
  sub TEXT,
  tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_device_pk BIGINT;
BEGIN
  IF p_device_id IS NULL OR btrim(p_device_id) = '' OR p_device_secret IS NULL OR btrim(p_device_secret) = '' THEN
    RAISE EXCEPTION 'unauthorized_device' USING ERRCODE = '28000';
  END IF;

  v_hash := encode(sha256(convert_to(p_device_secret, 'UTF8')), 'hex');

  SELECT d.id
    INTO v_device_pk
    FROM public.admin_alert_devices d
    JOIN public.profiles p ON p.id = d.user_id
   WHERE d.device_id = p_device_id
     AND d.secret_hash = v_hash
     AND d.active = true
     AND p.rol IN ('admin', 'super_admin')
   LIMIT 1;

  IF v_device_pk IS NULL THEN
    RAISE EXCEPTION 'unauthorized_device' USING ERRCODE = '28000';
  END IF;

  -- Actualizar last_seen_at como máximo una vez cada 15 min para evitar I/O innecesario
  UPDATE public.admin_alert_devices
     SET last_seen_at = now()
   WHERE public.admin_alert_devices.id = v_device_pk
     AND public.admin_alert_devices.last_seen_at < (now() - INTERVAL '15 minutes');

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.tipo,
    a.titulo,
    LEFT(a.cuerpo, 240)::TEXT AS cuerpo,
    a.url,
    a.seccion,
    a.sub,
    a.tag
  FROM public.admin_alerts a
  WHERE a.id > COALESCE(p_after_id, 0)
  ORDER BY a.id ASC
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.poll_admin_alerts(TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_admin_alerts(TEXT, TEXT, BIGINT) TO anon, authenticated;
