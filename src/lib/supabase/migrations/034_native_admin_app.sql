-- ============================================================================
-- MIGRACIÓN 034: SOPORTE COMPLETO PARA APP ANDROID 100% NATIVA (100% SUPABASE)
-- Ejecutar en Supabase SQL Editor después de 032 y 033
-- ============================================================================

-- 1. HELPER DE AUTORIZACIÓN PARA ADMINISTRADORES
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = auth.uid()
       AND rol IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- 2. POLÍTICAS RLS IDEMPOTENTES PARA QUE EL ADMIN OPERE DIRECTO DESDE LA APP NATIVA
DO $$
BEGIN
  -- pedidos
  IF to_regclass('public.pedidos') IS NOT NULL THEN
    ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'pedidos'
        AND policyname = 'Admins gestionan todos los pedidos'
    ) THEN
      CREATE POLICY "Admins gestionan todos los pedidos"
        ON public.pedidos FOR ALL
        TO authenticated
        USING (public.is_admin_user())
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- pedidos_personalizados
  IF to_regclass('public.pedidos_personalizados') IS NOT NULL THEN
    ALTER TABLE public.pedidos_personalizados ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'pedidos_personalizados'
        AND policyname = 'Admins gestionan pedidos personalizados'
    ) THEN
      CREATE POLICY "Admins gestionan pedidos personalizados"
        ON public.pedidos_personalizados FOR ALL
        TO authenticated
        USING (public.is_admin_user())
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- suscriptores
  IF to_regclass('public.suscriptores') IS NOT NULL THEN
    ALTER TABLE public.suscriptores ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'suscriptores'
        AND policyname = 'Admins leen suscriptores'
    ) THEN
      CREATE POLICY "Admins leen suscriptores"
        ON public.suscriptores FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'suscriptores'
        AND policyname = 'Admins actualizan suscriptores'
    ) THEN
      CREATE POLICY "Admins actualizan suscriptores"
        ON public.suscriptores FOR UPDATE
        TO authenticated
        USING (public.is_admin_user())
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- profiles
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND policyname = 'Admins leen todos los perfiles'
    ) THEN
      CREATE POLICY "Admins leen todos los perfiles"
        ON public.profiles FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
  END IF;

  -- libro_reclamaciones
  IF to_regclass('public.libro_reclamaciones') IS NOT NULL THEN
    ALTER TABLE public.libro_reclamaciones ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'libro_reclamaciones'
        AND policyname = 'Admins leen libro de reclamaciones'
    ) THEN
      CREATE POLICY "Admins leen libro de reclamaciones"
        ON public.libro_reclamaciones FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
  END IF;

  -- resenas
  IF to_regclass('public.resenas') IS NOT NULL THEN
    ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'resenas'
        AND policyname = 'Admins gestionan resenas'
    ) THEN
      CREATE POLICY "Admins gestionan resenas"
        ON public.resenas FOR ALL
        TO authenticated
        USING (public.is_admin_user())
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- notificaciones
  IF to_regclass('public.notificaciones') IS NOT NULL THEN
    ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notificaciones'
        AND policyname = 'Admins leen notificaciones'
    ) THEN
      CREATE POLICY "Admins leen notificaciones"
        ON public.notificaciones FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notificaciones'
        AND policyname = 'Admins insertan notificaciones'
    ) THEN
      CREATE POLICY "Admins insertan notificaciones"
        ON public.notificaciones FOR INSERT
        TO authenticated
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- admin_alerts
  IF to_regclass('public.admin_alerts') IS NOT NULL THEN
    ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_alerts'
        AND policyname = 'Admins leen alertas nativas'
    ) THEN
      CREATE POLICY "Admins leen alertas nativas"
        ON public.admin_alerts FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_alerts'
        AND policyname = 'Admins insertan alertas nativas'
    ) THEN
      CREATE POLICY "Admins insertan alertas nativas"
        ON public.admin_alerts FOR INSERT
        TO authenticated
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;

  -- mensajes_contacto (solo si la tabla existe en la BD)
  IF to_regclass('public.mensajes_contacto') IS NOT NULL THEN
    ALTER TABLE public.mensajes_contacto ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'mensajes_contacto'
        AND policyname = 'Admins leen mensajes de contacto'
    ) THEN
      CREATE POLICY "Admins leen mensajes de contacto"
        ON public.mensajes_contacto FOR SELECT
        TO authenticated
        USING (public.is_admin_user());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'mensajes_contacto'
        AND policyname = 'Admins actualizan mensajes de contacto'
    ) THEN
      CREATE POLICY "Admins actualizan mensajes de contacto"
        ON public.mensajes_contacto FOR UPDATE
        TO authenticated
        USING (public.is_admin_user())
        WITH CHECK (public.is_admin_user());
    END IF;
  END IF;
END $$;

-- 3. REGISTRAR DISPOSITIVO NATIVO PARA POLLING DE ALERTAS EN SEGUNDO PLANO
CREATE OR REPLACE FUNCTION public.register_admin_alert_device(
  p_device_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_device_id TEXT;
  v_secret TEXT;
  v_hash TEXT;
  v_latest_id BIGINT := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_device_id := LEFT(COALESCE(NULLIF(btrim(p_device_id), ''), 'android-default'), 128);
  v_secret := encode(
    sha256(
      convert_to(
        gen_random_uuid()::text || clock_timestamp()::text || random()::text || v_uid::text,
        'UTF8'
      )
    ),
    'hex'
  );
  v_hash := encode(sha256(convert_to(v_secret, 'UTF8')), 'hex');

  INSERT INTO public.admin_alert_devices (
    user_id,
    device_id,
    secret_hash,
    platform,
    device_name,
    app_version,
    active,
    last_seen_at,
    updated_at
  )
  VALUES (
    v_uid,
    v_device_id,
    v_hash,
    'android',
    NULLIF(LEFT(COALESCE(btrim(p_device_name), ''), 200), ''),
    NULLIF(LEFT(COALESCE(btrim(p_app_version), ''), 64), ''),
    true,
    now(),
    now()
  )
  ON CONFLICT (device_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        secret_hash = EXCLUDED.secret_hash,
        platform = EXCLUDED.platform,
        device_name = EXCLUDED.device_name,
        app_version = EXCLUDED.app_version,
        active = true,
        last_seen_at = now(),
        updated_at = now();

  SELECT COALESCE(MAX(id), 0)
    INTO v_latest_id
    FROM public.admin_alerts;

  RETURN jsonb_build_object(
    'ok', true,
    'device_id', v_device_id,
    'device_secret', v_secret,
    'latest_alert_id', v_latest_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_admin_alert_device(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_admin_alert_device(TEXT, TEXT, TEXT) TO authenticated;

-- 4. DESREGISTRAR DISPOSITIVO NATIVO AL CERRAR SESIÓN
CREATE OR REPLACE FUNCTION public.unregister_admin_alert_device(
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_device_id TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_device_id := LEFT(COALESCE(btrim(p_device_id), ''), 128);
  IF v_device_id <> '' THEN
    DELETE FROM public.admin_alert_devices
     WHERE user_id = v_uid
       AND device_id = v_device_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.unregister_admin_alert_device(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_admin_alert_device(TEXT) TO authenticated;

-- 5. ENVIAR ALERTA DE PRUEBA DIRECTO DESDE LA APP NATIVA
CREATE OR REPLACE FUNCTION public.send_admin_test_alert()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alert_id BIGINT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admin_alerts (
    tipo,
    titulo,
    cuerpo,
    url,
    seccion,
    sub,
    tag,
    payload
  )
  VALUES (
    'prueba',
    'Alerta de prueba Entre Hilos',
    'Tu app Android 100% nativa está conectada directamente a Supabase.',
    '/admin?seccion=pedidos&sub=pedidos',
    'pedidos',
    'pedidos',
    'eh-test-' || FLOOR(EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    jsonb_build_object('tipo', 'prueba', 'userId', v_uid)
  )
  RETURNING id INTO v_alert_id;

  RETURN jsonb_build_object('ok', true, 'id', v_alert_id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_admin_test_alert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_admin_test_alert() TO authenticated;

-- 6. ACTUALIZAR ESTADO DE PEDIDO ESTÁNDAR + NOTIFICACIÓN AL CLIENTE
CREATE OR REPLACE FUNCTION public.admin_update_pedido_estado(
  p_pedido_id BIGINT,
  p_estado TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_estado TEXT;
  v_ped RECORD;
  v_notif_titulo TEXT;
  v_notif_mensaje TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_estado := lower(btrim(COALESCE(p_estado, '')));
  IF v_estado NOT IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de pedido inválido: %', p_estado;
  END IF;

  UPDATE public.pedidos
     SET estado = v_estado
   WHERE id = p_pedido_id
   RETURNING id, usuario_id, cliente_email, cliente_nombre INTO v_ped;

  IF v_ped.id IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  v_notif_titulo := CASE v_estado
    WHEN 'entregado' THEN 'Tu Pedido #' || p_pedido_id || ' ha sido entregado'
    WHEN 'enviado' THEN 'Tu Pedido #' || p_pedido_id || ' va en camino'
    WHEN 'confirmado' THEN 'Tu Pedido #' || p_pedido_id || ' fue confirmado'
    WHEN 'cancelado' THEN 'Tu Pedido #' || p_pedido_id || ' fue cancelado'
    ELSE 'Actualización de Pedido #' || p_pedido_id
  END;

  v_notif_mensaje := CASE v_estado
    WHEN 'entregado' THEN 'Tu detalle tejido a mano fue entregado con éxito. Gracias por confiar en Entre Hilos.'
    WHEN 'enviado' THEN 'Tu pedido ha sido despachado y se encuentra en camino a tu dirección de entrega.'
    WHEN 'confirmado' THEN 'Confirmamos tu pedido y estamos preparándolo en nuestro taller.'
    WHEN 'cancelado' THEN 'Tu pedido ha sido cancelado. Si tienes alguna duda, escríbenos a soporte.'
    ELSE 'El estado de tu pedido cambió a ' || v_estado || '.'
  END;

  BEGIN
    INSERT INTO public.notificaciones (
      usuario_id,
      email,
      pedido_id,
      tipo,
      titulo,
      mensaje,
      leido
    )
    VALUES (
      v_ped.usuario_id,
      v_ped.cliente_email,
      p_pedido_id,
      v_estado,
      v_notif_titulo,
      v_notif_mensaje,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'id', v_ped.id, 'estado', v_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_pedido_estado(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_pedido_estado(BIGINT, TEXT) TO authenticated;

-- 7. ACTUALIZAR ESTADO DE PEDIDO PERSONALIZADO + NOTIFICACIÓN AL CLIENTE
CREATE OR REPLACE FUNCTION public.admin_update_personalizado_estado(
  p_pedido_id BIGINT,
  p_estado TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_estado TEXT;
  v_pers RECORD;
  v_notif_titulo TEXT;
  v_notif_mensaje TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_estado := lower(btrim(COALESCE(p_estado, '')));
  IF v_estado NOT IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de pedido personalizado inválido: %', p_estado;
  END IF;

  UPDATE public.pedidos_personalizados
     SET estado = v_estado
   WHERE id = p_pedido_id
   RETURNING id, email, nombre_cliente, producto_nombre INTO v_pers;

  IF v_pers.id IS NULL THEN
    RAISE EXCEPTION 'Pedido personalizado no encontrado';
  END IF;

  v_notif_titulo := CASE v_estado
    WHEN 'entregado' THEN 'Tu pedido personalizado ha sido entregado'
    WHEN 'listo' THEN 'Tu pedido personalizado está listo'
    WHEN 'en_produccion' THEN 'Tu pedido personalizado está en producción'
    ELSE 'Actualización de pedido personalizado'
  END;

  v_notif_mensaje := CASE v_estado
    WHEN 'entregado' THEN 'Tu pedido personalizado fue entregado con éxito.'
    WHEN 'listo' THEN 'Tu detalle personalizado está listo para coordinar la entrega.'
    WHEN 'en_produccion' THEN 'Comenzamos a confeccionar tu pedido personalizado con dedicación.'
    ELSE 'El estado de tu pedido personalizado cambió a ' || v_estado || '.'
  END;

  BEGIN
    INSERT INTO public.notificaciones (
      email,
      pedido_id,
      tipo,
      titulo,
      mensaje,
      leido
    )
    VALUES (
      v_pers.email,
      p_pedido_id,
      v_estado,
      v_notif_titulo,
      v_notif_mensaje,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'id', v_pers.id, 'estado', v_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_personalizado_estado(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_personalizado_estado(BIGINT, TEXT) TO authenticated;

-- 8. AGENDAR PEDIDO DESDE APP NATIVA + VINCULAR PERFIL + ALERTA INMEDIATA
CREATE OR REPLACE FUNCTION public.admin_agendar_pedido(
  p_origen TEXT,
  p_cliente_nombre TEXT,
  p_cliente_telefono TEXT,
  p_cliente_email TEXT,
  p_direccion_envio TEXT,
  p_items JSONB,
  p_total NUMERIC,
  p_adelanto NUMERIC,
  p_fecha_entrega TEXT,
  p_hora_entrega TEXT,
  p_metodo_pago TEXT,
  p_estado TEXT,
  p_notas TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nombre TEXT;
  v_tel TEXT;
  v_tel_digits TEXT;
  v_email TEXT;
  v_usuario_id TEXT;
  v_dir TEXT;
  v_origen TEXT;
  v_metodo TEXT;
  v_estado TEXT;
  v_fecha_ts TIMESTAMPTZ := NULL;
  v_fecha_date DATE := NULL;
  v_hora TEXT;
  v_notas TEXT;
  v_total NUMERIC(10,2);
  v_adelanto NUMERIC(10,2);
  v_saldo NUMERIC(10,2);
  v_pedido_id BIGINT;
  v_resumen_fecha TEXT := '';
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_nombre := btrim(COALESCE(p_cliente_nombre, ''));
  IF v_nombre = '' THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un producto o ítem al pedido';
  END IF;

  v_tel := btrim(COALESCE(p_cliente_telefono, ''));
  v_tel_digits := regexp_replace(v_tel, '\D', '', 'g');
  v_email := NULLIF(btrim(COALESCE(p_cliente_email, '')), '');
  v_dir := COALESCE(NULLIF(btrim(COALESCE(p_direccion_envio, '')), ''), 'Coordinar por WhatsApp');
  v_origen := COALESCE(NULLIF(lower(btrim(COALESCE(p_origen, ''))), ''), 'whatsapp');
  v_metodo := COALESCE(NULLIF(lower(btrim(COALESCE(p_metodo_pago, ''))), ''), 'yape');
  v_estado := COALESCE(NULLIF(lower(btrim(COALESCE(p_estado, ''))), ''), 'pendiente');
  v_hora := NULLIF(btrim(COALESCE(p_hora_entrega, '')), '');
  v_notas := NULLIF(btrim(COALESCE(p_notas, '')), '');

  v_total := GREATEST(0, COALESCE(p_total, 0));
  v_adelanto := GREATEST(0, COALESCE(p_adelanto, 0));
  v_saldo := GREATEST(0, v_total - v_adelanto);

  IF btrim(COALESCE(p_fecha_entrega, '')) ~ '^\d{4}-\d{2}-\d{2}' THEN
    v_fecha_date := LEFT(btrim(p_fecha_entrega), 10)::DATE;
    v_fecha_ts := (v_fecha_date + TIME '12:00') AT TIME ZONE 'America/Lima';
    v_resumen_fecha := ' · Entrega: ' || to_char(v_fecha_date, 'DD/MM/YYYY') || ' · ' || COALESCE(v_hora, '09:00 (ref.)');
  END IF;

  -- Vincular automáticamente con cuenta registrada del cliente si existe
  IF v_email IS NOT NULL THEN
    SELECT id::text INTO v_usuario_id
      FROM public.profiles
     WHERE lower(email) = lower(v_email)
     LIMIT 1;
  ELSIF length(v_tel_digits) >= 7 THEN
    SELECT id::text, NULLIF(btrim(email), '') INTO v_usuario_id, v_email
      FROM public.profiles
     WHERE regexp_replace(COALESCE(telefono, ''), '\D', '', 'g') = v_tel_digits
     LIMIT 1;
  END IF;

  INSERT INTO public.pedidos (
    origen,
    usuario_id,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    direccion_envio,
    items,
    total,
    adelanto,
    saldo_pendiente,
    fecha_entrega,
    hora_entrega,
    metodo_pago,
    estado,
    notas
  )
  VALUES (
    v_origen,
    v_usuario_id,
    v_nombre,
    v_tel,
    v_email,
    v_dir,
    p_items,
    v_total,
    v_adelanto,
    v_saldo,
    v_fecha_ts,
    v_hora,
    v_metodo,
    v_estado,
    v_notas
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO public.admin_alerts (
    tipo,
    titulo,
    cuerpo,
    url,
    seccion,
    sub,
    tag,
    payload
  )
  VALUES (
    'pedido_agendado',
    'Pedido agendado #' || v_pedido_id || ' (' || v_origen || ')',
    v_nombre || ' — S/ ' || to_char(v_total, 'FM999999990.00') || v_resumen_fecha,
    '/admin?seccion=pedidos&sub=pedidos',
    'pedidos',
    'pedidos',
    'eh-agendado-' || v_pedido_id,
    jsonb_build_object('tipo', 'pedido_agendado', 'pedidoId', v_pedido_id, 'origen', v_origen)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_pedido_id, 'usuario_id', v_usuario_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_agendar_pedido(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_agendar_pedido(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 9. AGENDAR PEDIDO PERSONALIZADO DESDE APP NATIVA + ALERTA INMEDIATA
CREATE OR REPLACE FUNCTION public.admin_agendar_personalizado(
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_email TEXT,
  p_producto_nombre TEXT,
  p_producto_precio NUMERIC,
  p_detalles TEXT,
  p_colores TEXT,
  p_tamano TEXT,
  p_extras TEXT,
  p_fecha_entrega DATE,
  p_hora_entrega TEXT,
  p_estado TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nombre TEXT;
  v_tel TEXT;
  v_detalles TEXT;
  v_estado TEXT;
  v_prod TEXT;
  v_hora TEXT;
  v_pers_id BIGINT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_nombre := btrim(COALESCE(p_nombre_cliente, ''));
  v_tel := btrim(COALESCE(p_telefono, ''));
  v_detalles := btrim(COALESCE(p_detalles, ''));
  v_estado := COALESCE(NULLIF(lower(btrim(COALESCE(p_estado, ''))), ''), 'pendiente');

  IF v_nombre = '' OR v_tel = '' OR v_detalles = '' OR p_fecha_entrega IS NULL THEN
    RAISE EXCEPTION 'Nombre, teléfono, detalles y fecha de entrega son obligatorios';
  END IF;

  IF v_estado NOT IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'entregado', 'cancelado') THEN
    v_estado := 'pendiente';
  END IF;

  v_prod := NULLIF(btrim(COALESCE(p_producto_nombre, '')), '');
  v_hora := NULLIF(btrim(COALESCE(p_hora_entrega, '')), '');

  INSERT INTO public.pedidos_personalizados (
    nombre_cliente,
    telefono,
    email,
    producto_nombre,
    producto_precio,
    detalles,
    colores,
    tamano,
    extras,
    fecha_entrega,
    hora_entrega,
    estado
  )
  VALUES (
    v_nombre,
    v_tel,
    NULLIF(btrim(COALESCE(p_email, '')), ''),
    v_prod,
    CASE WHEN p_producto_precio IS NOT NULL AND p_producto_precio > 0 THEN p_producto_precio ELSE NULL END,
    v_detalles,
    NULLIF(btrim(COALESCE(p_colores, '')), ''),
    NULLIF(btrim(COALESCE(p_tamano, '')), ''),
    NULLIF(btrim(COALESCE(p_extras, '')), ''),
    p_fecha_entrega,
    v_hora,
    v_estado
  )
  RETURNING id INTO v_pers_id;

  INSERT INTO public.admin_alerts (
    tipo,
    titulo,
    cuerpo,
    url,
    seccion,
    sub,
    tag,
    payload
  )
  VALUES (
    'pedido_personalizado',
    'Nuevo pedido personalizado #' || v_pers_id,
    v_nombre || COALESCE(' — ' || v_prod, '') || ' · Entrega: ' || to_char(p_fecha_entrega, 'DD/MM/YYYY') || ' · ' || COALESCE(v_hora, '09:00 (ref.)'),
    '/admin?seccion=pedidos&sub=personalizados',
    'pedidos',
    'personalizados',
    'eh-personalizado-' || v_pers_id,
    jsonb_build_object('tipo', 'pedido_personalizado', 'pedidoId', v_pers_id)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_pers_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_agendar_personalizado(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_agendar_personalizado(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;
