-- ============================================================================
-- MIGRACIÓN 037: RECORDATORIOS DIARIOS POR HORA DE ENTREGA + DEFAULT 12:00 P.M.
-- Ejecutar en Supabase SQL Editor después de 033/036
-- ============================================================================

-- 1. COLUMNAS DE SEGUIMIENTO DIARIO EN PEDIDOS Y PERSONALIZADOS
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS last_daily_reminder_date DATE;

ALTER TABLE public.pedidos_personalizados
  ADD COLUMN IF NOT EXISTS last_daily_reminder_date DATE;

-- 2. ESTADO ATÓMICO DE THROTTLE (EVITA EJECUCIÓN EN CADA POLLING DE CELULARES)
CREATE TABLE IF NOT EXISTS public.admin_delivery_check_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);

ALTER TABLE public.admin_delivery_check_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_delivery_check_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 3. EXTRACCIÓN DE HORA LIMA (POR DEFECTO 12:00 P.M. / MEDIODÍA)
CREATE OR REPLACE FUNCTION public.extract_delivery_clock_lima(p_hora TEXT)
RETURNS TIME
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean TEXT;
  v_match TEXT[];
  v_h INT := 12;
  v_m INT := 0;
  v_ampm TEXT;
BEGIN
  v_clean := lower(
    translate(
      COALESCE(btrim(p_hora), ''),
      'áéíóúüÁÉÍÓÚÜ',
      'aeiouuAEIOUU'
    )
  );

  IF v_clean = '' THEN
    RETURN TIME '12:00:00';
  END IF;

  -- 1. Formato 12h con am/pm (ej. "8:00 a.m.", "3:30 pm", "10am", "12:00 pm")
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
      RETURN make_time(v_h, v_m, 0);
    END IF;
  END IF;

  -- 2. Formato 24h HH:MM (ej. "08:00", "15:30", "14:00 - 16:00")
  v_match := regexp_match(v_clean, '(\d{1,2})\s*:\s*(\d{2})');
  IF v_match IS NOT NULL THEN
    v_h := v_match[1]::INT;
    v_m := v_match[2]::INT;
    IF v_h BETWEEN 0 AND 23 AND v_m BETWEEN 0 AND 59 THEN
      RETURN make_time(v_h, v_m, 0);
    END IF;
  END IF;

  -- 3. Hora con sufijo h/hrs (ej. "8h", "14h", "16 hrs")
  v_match := regexp_match(v_clean, '\m(\d{1,2})\s*(?:h|hs|hrs)\M');
  IF v_match IS NOT NULL THEN
    v_h := v_match[1]::INT;
    v_m := 0;
    IF v_h BETWEEN 0 AND 23 THEN
      RETURN make_time(v_h, v_m, 0);
    END IF;
  END IF;

  -- 4. Referencias textuales
  IF v_clean ~ '\m(mediodia|medio\s*dia)\M' THEN
    RETURN TIME '12:00:00';
  ELSIF v_clean ~ '\m(manana|temprano|am)\M' THEN
    RETURN TIME '09:00:00';
  ELSIF v_clean ~ '\m(tarde|pm)\M' THEN
    RETURN TIME '14:00:00';
  ELSIF v_clean ~ '\mnoche\M' THEN
    RETURN TIME '19:00:00';
  END IF;

  RETURN TIME '12:00:00';
END;
$$;

CREATE OR REPLACE FUNCTION public.parse_delivery_ts_lima(
  p_date DATE,
  p_hora TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (p_date + public.extract_delivery_clock_lima(p_hora)) AT TIME ZONE 'America/Lima';
END;
$$;

CREATE OR REPLACE FUNCTION public.format_hora_lima_12h(p_hora TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_time TIME := public.extract_delivery_clock_lima(p_hora);
  v_h INT := EXTRACT(HOUR FROM v_time)::INT;
  v_m INT := EXTRACT(MINUTE FROM v_time)::INT;
  v_suffix TEXT;
  v_h12 INT;
BEGIN
  v_suffix := CASE WHEN v_h < 12 THEN 'a.m.' ELSE 'p.m.' END;
  v_h12 := CASE
    WHEN v_h = 0 THEN 12
    WHEN v_h > 12 THEN v_h - 12
    ELSE v_h
  END;

  RETURN v_h12 || ':' || lpad(v_m::TEXT, 2, '0') || ' ' || v_suffix;
END;
$$;

-- 4. RESET DE BANDERAS SI SE REPROGRAMA FECHA U HORA DE ENTREGA
CREATE OR REPLACE FUNCTION public.reset_delivery_notification_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega)
     OR (NEW.hora_entrega IS DISTINCT FROM OLD.hora_entrega) THEN
    NEW.notified_24h_at := NULL;
    NEW.notified_2h_at := NULL;
    NEW.last_daily_reminder_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_reset_delivery_notifs ON public.pedidos;
CREATE TRIGGER trg_pedidos_reset_delivery_notifs
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_delivery_notification_flags();

DROP TRIGGER IF EXISTS trg_pedidos_personalizados_reset_delivery_notifs ON public.pedidos_personalizados;
CREATE TRIGGER trg_pedidos_personalizados_reset_delivery_notifs
  BEFORE UPDATE ON public.pedidos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_delivery_notification_flags();

-- 5. RECORDATORIO DIARIO A LA HORA PROGRAMADA + ALERTA URGENTE 2H ANTES
CREATE OR REPLACE FUNCTION public.check_upcoming_deliveries_alerts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_today_lima DATE := (v_now AT TIME ZONE 'America/Lima')::DATE;
  v_active_devices BIGINT := 0;
  v_checked_pedidos INT := 0;
  v_checked_pers INT := 0;
  v_sent_24h INT := 0;
  v_sent_2h INT := 0;
  v_sent_daily INT := 0;
  v_date_lima DATE;
  v_clock_time TIME;
  v_delivery_ts TIMESTAMPTZ;
  v_today_reminder_ts TIMESTAMPTZ;
  v_days_left INT;
  v_mins_to_delivery NUMERIC;
  v_mins_since_daily NUMERIC;
  v_hora_fmt TEXT;
  v_resumen TEXT;
  v_extra TEXT;
  v_tiempo TEXT;
  v_cliente TEXT;
  v_rem_mins INT;
  r_ped RECORD;
  r_pers RECORD;
BEGIN
  DELETE FROM public.admin_alerts
   WHERE created_at < (v_now - INTERVAL '14 days');

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
      'sent2h', 0,
      'sentDaily', 0
    );
  END IF;

  -- A) PEDIDOS ESTÁNDAR
  FOR r_ped IN
    SELECT id, created_at, cliente_nombre, total, estado, fecha_entrega, hora_entrega,
           notified_24h_at, notified_2h_at, last_daily_reminder_date
      FROM public.pedidos
     WHERE fecha_entrega IS NOT NULL
       AND COALESCE(lower(btrim(estado)), '') NOT IN ('entregado', 'cancelado')
  LOOP
    v_date_lima := (r_ped.fecha_entrega AT TIME ZONE 'America/Lima')::DATE;
    IF v_date_lima IS NULL THEN
      CONTINUE;
    END IF;

    v_clock_time := public.extract_delivery_clock_lima(r_ped.hora_entrega);
    v_delivery_ts := (v_date_lima + v_clock_time) AT TIME ZONE 'America/Lima';
    v_today_reminder_ts := (v_today_lima + v_clock_time) AT TIME ZONE 'America/Lima';
    v_days_left := v_date_lima - v_today_lima;
    v_mins_to_delivery := EXTRACT(EPOCH FROM (v_delivery_ts - v_now)) / 60.0;
    v_mins_since_daily := EXTRACT(EPOCH FROM (v_now - v_today_reminder_ts)) / 60.0;

    v_checked_pedidos := v_checked_pedidos + 1;
    v_cliente := COALESCE(NULLIF(btrim(r_ped.cliente_nombre), ''), 'Cliente');
    v_hora_fmt := public.format_hora_lima_12h(r_ped.hora_entrega);
    v_resumen := to_char(v_date_lima, 'DD/MM/YYYY') || ' · ' || v_hora_fmt;
    v_extra := CASE
      WHEN COALESCE(r_ped.total, 0) > 0 THEN ' (S/ ' || to_char(r_ped.total, 'FM999999990.00') || ')'
      ELSE ''
    END;

    -- Caso A: Alerta urgente 2h antes de la entrega
    IF v_mins_to_delivery <= 120 AND v_mins_to_delivery > 0 AND r_ped.notified_2h_at IS NULL THEN
      v_rem_mins := GREATEST(1, ROUND(v_mins_to_delivery)::INT);
      v_tiempo := CASE
        WHEN v_rem_mins < 60 THEN 'en ' || v_rem_mins || ' min'
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_2h',
        'Entrega muy próxima (' || v_tiempo || ')',
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
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

    -- Caso B: Día de entrega exacto a la hora programada
    ELSIF v_days_left = 0
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_ped.last_daily_reminder_date IS NULL OR r_ped.last_daily_reminder_date < v_today_lima)
      AND (v_now - r_ped.created_at >= INTERVAL '15 minutes') THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_hoy',
        '¡Entrega HOY (' || v_hora_fmt || ')!',
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
        '/admin?seccion=pedidos&sub=pedidos',
        'pedidos',
        'pedidos',
        'eh-diaria-pedidos-' || r_ped.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_ped.id, 'tabla', 'pedidos', 'ventana', 'hoy', 'daysLeft', 0)
      );

      UPDATE public.pedidos
         SET last_daily_reminder_date = v_today_lima,
             notified_2h_at = COALESCE(notified_2h_at, v_now),
             notified_24h_at = COALESCE(notified_24h_at, v_now)
       WHERE id = r_ped.id;

      v_sent_daily := v_sent_daily + 1;

    -- Caso C: Recordatorio diario todos los días previos a la hora programada
    ELSIF v_days_left >= 1
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_ped.last_daily_reminder_date IS NULL OR r_ped.last_daily_reminder_date < v_today_lima)
      AND (v_now - r_ped.created_at >= INTERVAL '15 minutes') THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        CASE WHEN v_days_left = 1 THEN 'entrega_24h' ELSE 'entrega_diaria' END,
        CASE
          WHEN v_days_left = 1 THEN '¡Entrega mañana! (Falta 1 día)'
          ELSE 'Faltan ' || v_days_left || ' días para entrega'
        END,
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
        '/admin?seccion=pedidos&sub=pedidos',
        'pedidos',
        'pedidos',
        'eh-diaria-pedidos-' || r_ped.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_ped.id, 'tabla', 'pedidos', 'ventana', 'diaria', 'daysLeft', v_days_left)
      );

      UPDATE public.pedidos
         SET last_daily_reminder_date = v_today_lima,
             notified_24h_at = CASE WHEN v_days_left = 1 THEN COALESCE(notified_24h_at, v_now) ELSE notified_24h_at END
       WHERE id = r_ped.id;

      IF v_days_left = 1 THEN
        v_sent_24h := v_sent_24h + 1;
      ELSE
        v_sent_daily := v_sent_daily + 1;
      END IF;

    -- Caso D: Entrega atrasada — recordatorio diario a la hora programada
    ELSIF v_days_left < 0
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_ped.last_daily_reminder_date IS NULL OR r_ped.last_daily_reminder_date < v_today_lima) THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_atrasada',
        '¡Entrega atrasada (' || ABS(v_days_left) || CASE WHEN ABS(v_days_left) = 1 THEN ' día' ELSE ' días' END || ')!',
        'Pedido #' || r_ped.id || ' de ' || v_cliente || v_extra || ' — Programado: ' || v_resumen,
        '/admin?seccion=pedidos&sub=pedidos',
        'pedidos',
        'pedidos',
        'eh-diaria-pedidos-' || r_ped.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_ped.id, 'tabla', 'pedidos', 'ventana', 'atrasada', 'daysLeft', v_days_left)
      );

      UPDATE public.pedidos
         SET last_daily_reminder_date = v_today_lima
       WHERE id = r_ped.id;

      v_sent_daily := v_sent_daily + 1;
    END IF;
  END LOOP;

  -- B) PEDIDOS PERSONALIZADOS
  FOR r_pers IN
    SELECT id, created_at, nombre_cliente, producto_nombre, estado, fecha_entrega, hora_entrega,
           notified_24h_at, notified_2h_at, last_daily_reminder_date
      FROM public.pedidos_personalizados
     WHERE fecha_entrega IS NOT NULL
       AND COALESCE(lower(btrim(estado)), '') NOT IN ('entregado', 'cancelado')
  LOOP
    v_date_lima := r_pers.fecha_entrega::DATE;
    IF v_date_lima IS NULL THEN
      CONTINUE;
    END IF;

    v_clock_time := public.extract_delivery_clock_lima(r_pers.hora_entrega);
    v_delivery_ts := (v_date_lima + v_clock_time) AT TIME ZONE 'America/Lima';
    v_today_reminder_ts := (v_today_lima + v_clock_time) AT TIME ZONE 'America/Lima';
    v_days_left := v_date_lima - v_today_lima;
    v_mins_to_delivery := EXTRACT(EPOCH FROM (v_delivery_ts - v_now)) / 60.0;
    v_mins_since_daily := EXTRACT(EPOCH FROM (v_now - v_today_reminder_ts)) / 60.0;

    v_checked_pers := v_checked_pers + 1;
    v_cliente := COALESCE(NULLIF(btrim(r_pers.nombre_cliente), ''), 'Cliente');
    v_hora_fmt := public.format_hora_lima_12h(r_pers.hora_entrega);
    v_resumen := to_char(v_date_lima, 'DD/MM/YYYY') || ' · ' || v_hora_fmt;
    v_extra := CASE
      WHEN NULLIF(btrim(r_pers.producto_nombre), '') IS NOT NULL THEN ' (' || btrim(r_pers.producto_nombre) || ')'
      ELSE ''
    END;

    -- Caso A: Alerta urgente 2h antes de la entrega
    IF v_mins_to_delivery <= 120 AND v_mins_to_delivery > 0 AND r_pers.notified_2h_at IS NULL THEN
      v_rem_mins := GREATEST(1, ROUND(v_mins_to_delivery)::INT);
      v_tiempo := CASE
        WHEN v_rem_mins < 60 THEN 'en ' || v_rem_mins || ' min'
        WHEN (v_rem_mins % 60) > 0 THEN 'en ' || (v_rem_mins / 60) || 'h ' || (v_rem_mins % 60) || 'm'
        ELSE 'en ' || (v_rem_mins / 60) || 'h'
      END;

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_2h',
        'Entrega muy próxima (' || v_tiempo || ')',
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
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

    -- Caso B: Día de entrega exacto a la hora programada
    ELSIF v_days_left = 0
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_pers.last_daily_reminder_date IS NULL OR r_pers.last_daily_reminder_date < v_today_lima)
      AND (v_now - r_pers.created_at >= INTERVAL '15 minutes') THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_hoy',
        '¡Entrega HOY (' || v_hora_fmt || ')!',
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
        '/admin?seccion=pedidos&sub=personalizados',
        'pedidos',
        'personalizados',
        'eh-diaria-pedidos_personalizados-' || r_pers.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_pers.id, 'tabla', 'pedidos_personalizados', 'ventana', 'hoy', 'daysLeft', 0)
      );

      UPDATE public.pedidos_personalizados
         SET last_daily_reminder_date = v_today_lima,
             notified_2h_at = COALESCE(notified_2h_at, v_now),
             notified_24h_at = COALESCE(notified_24h_at, v_now)
       WHERE id = r_pers.id;

      v_sent_daily := v_sent_daily + 1;

    -- Caso C: Recordatorio diario todos los días previos a la hora programada
    ELSIF v_days_left >= 1
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_pers.last_daily_reminder_date IS NULL OR r_pers.last_daily_reminder_date < v_today_lima)
      AND (v_now - r_pers.created_at >= INTERVAL '15 minutes') THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        CASE WHEN v_days_left = 1 THEN 'entrega_24h' ELSE 'entrega_diaria' END,
        CASE
          WHEN v_days_left = 1 THEN '¡Entrega mañana! (Falta 1 día)'
          ELSE 'Faltan ' || v_days_left || ' días para entrega'
        END,
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — Entrega: ' || v_resumen,
        '/admin?seccion=pedidos&sub=personalizados',
        'pedidos',
        'personalizados',
        'eh-diaria-pedidos_personalizados-' || r_pers.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_pers.id, 'tabla', 'pedidos_personalizados', 'ventana', 'diaria', 'daysLeft', v_days_left)
      );

      UPDATE public.pedidos_personalizados
         SET last_daily_reminder_date = v_today_lima,
             notified_24h_at = CASE WHEN v_days_left = 1 THEN COALESCE(notified_24h_at, v_now) ELSE notified_24h_at END
       WHERE id = r_pers.id;

      IF v_days_left = 1 THEN
        v_sent_24h := v_sent_24h + 1;
      ELSE
        v_sent_daily := v_sent_daily + 1;
      END IF;

    -- Caso D: Entrega atrasada — recordatorio diario a la hora programada
    ELSIF v_days_left < 0
      AND v_mins_since_daily >= 0
      AND v_mins_since_daily <= 90
      AND (r_pers.last_daily_reminder_date IS NULL OR r_pers.last_daily_reminder_date < v_today_lima) THEN

      INSERT INTO public.admin_alerts (tipo, titulo, cuerpo, url, seccion, sub, tag, payload)
      VALUES (
        'entrega_atrasada',
        '¡Entrega atrasada (' || ABS(v_days_left) || CASE WHEN ABS(v_days_left) = 1 THEN ' día' ELSE ' días' END || ')!',
        'Pedido personalizado #' || r_pers.id || ' de ' || v_cliente || v_extra || ' — Programado: ' || v_resumen,
        '/admin?seccion=pedidos&sub=personalizados',
        'pedidos',
        'personalizados',
        'eh-diaria-pedidos_personalizados-' || r_pers.id || '-' || to_char(v_today_lima, 'YYYYMMDD'),
        jsonb_build_object('pedidoId', r_pers.id, 'tabla', 'pedidos_personalizados', 'ventana', 'atrasada', 'daysLeft', v_days_left)
      );

      UPDATE public.pedidos_personalizados
         SET last_daily_reminder_date = v_today_lima
       WHERE id = r_pers.id;

      v_sent_daily := v_sent_daily + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'checkedAt', v_now,
    'checkedPedidos', v_checked_pedidos,
    'checkedPersonalizados', v_checked_pers,
    'sent24h', v_sent_24h,
    'sent2h', v_sent_2h,
    'sentDaily', v_sent_daily
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_upcoming_deliveries_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_upcoming_deliveries_alerts() TO service_role;

-- 6. POLL_ADMIN_ALERTS DISPARA REVISIÓN THROTTLEADA CADA 3 MIN (FUNCIONA SIN PG_CRON)
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

  UPDATE public.admin_alert_devices
     SET last_seen_at = now()
   WHERE public.admin_alert_devices.id = v_device_pk
     AND public.admin_alert_devices.last_seen_at < (now() - INTERVAL '15 minutes');

  -- Disparo atómico cada 3 minutos de los recordatorios diarios/2h/hoy/atrasados
  UPDATE public.admin_delivery_check_state
     SET last_checked_at = now()
   WHERE public.admin_delivery_check_state.id = 1
     AND public.admin_delivery_check_state.last_checked_at < (now() - INTERVAL '3 minutes');
  IF FOUND THEN
    PERFORM public.check_upcoming_deliveries_alerts();
  END IF;

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

-- 7. REPROGRAMAR PG_CRON CADA 5 MINUTOS SI LA EXTENSIÓN ESTÁ DISPONIBLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'entrehilos-upcoming-deliveries') THEN
      PERFORM cron.unschedule('entrehilos-upcoming-deliveries');
    END IF;
    PERFORM cron.schedule(
      'entrehilos-upcoming-deliveries',
      '*/5 * * * *',
      'SELECT public.trigger_upcoming_deliveries_cron();'
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
