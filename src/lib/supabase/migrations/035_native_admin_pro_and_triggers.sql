-- ============================================================================
-- MIGRACIÓN 035: EDICIÓN COMPLETA DE PEDIDOS + TRIGGERS AUTOMÁTICOS EN SUPABASE
-- Ejecutar en Supabase SQL Editor después de 032, 033 y 034
-- ============================================================================

-- 1. GARANTIZAR COLUMNAS REQUERIDAS
ALTER TABLE public.pedidos_personalizados
  ADD COLUMN IF NOT EXISTS hora_entrega TEXT;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fotos_entrega JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_tag_created
  ON public.admin_alerts (tag, created_at DESC)
  WHERE tag IS NOT NULL;

-- 2. RPC: EDITAR / GESTIONAR PEDIDO COMPLETO DESDE LA APP NATIVA
CREATE OR REPLACE FUNCTION public.admin_actualizar_pedido(
  p_pedido_id BIGINT,
  p_cliente_nombre TEXT,
  p_cliente_telefono TEXT,
  p_cliente_email TEXT,
  p_usuario_id TEXT,
  p_direccion_envio TEXT,
  p_estado TEXT,
  p_metodo_pago TEXT,
  p_adelanto NUMERIC,
  p_fecha_entrega TEXT,
  p_hora_entrega TEXT,
  p_notas TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing RECORD;
  v_nombre TEXT;
  v_tel TEXT;
  v_email TEXT;
  v_usuario_id TEXT;
  v_dir TEXT;
  v_estado TEXT;
  v_metodo TEXT;
  v_adelanto NUMERIC(10,2);
  v_saldo NUMERIC(10,2);
  v_fecha_ts TIMESTAMPTZ := NULL;
  v_hora TEXT;
  v_notas TEXT;
  v_notif_titulo TEXT;
  v_notif_mensaje TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, estado, total, usuario_id, cliente_email, cliente_nombre
    INTO v_existing
    FROM public.pedidos
   WHERE id = p_pedido_id;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Pedido #% no encontrado', p_pedido_id;
  END IF;

  v_estado := lower(btrim(COALESCE(NULLIF(p_estado, ''), v_existing.estado, 'pendiente')));
  IF v_estado NOT IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de pedido inválido: %', p_estado;
  END IF;

  v_nombre := COALESCE(NULLIF(btrim(COALESCE(p_cliente_nombre, '')), ''), v_existing.cliente_nombre, 'Cliente');
  v_tel := btrim(COALESCE(p_cliente_telefono, ''));
  v_email := NULLIF(btrim(COALESCE(p_cliente_email, '')), '');
  v_usuario_id := NULLIF(btrim(COALESCE(p_usuario_id, '')), '');
  IF v_usuario_id IS NULL THEN
    v_usuario_id := v_existing.usuario_id;
  END IF;
  v_dir := COALESCE(NULLIF(btrim(COALESCE(p_direccion_envio, '')), ''), 'Coordinar por WhatsApp');
  v_metodo := COALESCE(NULLIF(lower(btrim(COALESCE(p_metodo_pago, ''))), ''), 'yape');
  v_adelanto := GREATEST(0, COALESCE(p_adelanto, 0));
  v_saldo := GREATEST(0, COALESCE(v_existing.total, 0) - v_adelanto);
  v_hora := NULLIF(btrim(COALESCE(p_hora_entrega, '')), '');
  v_notas := NULLIF(btrim(COALESCE(p_notas, '')), '');

  IF btrim(COALESCE(p_fecha_entrega, '')) ~ '^\d{4}-\d{2}-\d{2}' THEN
    v_fecha_ts := (LEFT(btrim(p_fecha_entrega), 10)::DATE + TIME '12:00') AT TIME ZONE 'America/Lima';
  END IF;

  UPDATE public.pedidos
     SET cliente_nombre = v_nombre,
         cliente_telefono = v_tel,
         cliente_email = COALESCE(v_email, cliente_email),
         usuario_id = v_usuario_id,
         direccion_envio = v_dir,
         estado = v_estado,
         metodo_pago = v_metodo,
         adelanto = v_adelanto,
         saldo_pendiente = v_saldo,
         fecha_entrega = v_fecha_ts,
         hora_entrega = v_hora,
         notas = v_notas
   WHERE id = p_pedido_id;

  IF v_estado IS DISTINCT FROM v_existing.estado THEN
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
        v_usuario_id,
        COALESCE(v_email, v_existing.cliente_email),
        p_pedido_id,
        v_estado,
        v_notif_titulo,
        v_notif_mensaje,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_pedido_id, 'estado', v_estado, 'saldo_pendiente', v_saldo);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_actualizar_pedido(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_actualizar_pedido(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- 3. RPC: EDITAR PEDIDO PERSONALIZADO DESDE LA APP NATIVA
CREATE OR REPLACE FUNCTION public.admin_actualizar_personalizado(
  p_pedido_id BIGINT,
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
  v_existing RECORD;
  v_estado TEXT;
  v_nombre TEXT;
  v_tel TEXT;
  v_email TEXT;
  v_detalles TEXT;
  v_notif_titulo TEXT;
  v_notif_mensaje TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, estado, email, nombre_cliente
    INTO v_existing
    FROM public.pedidos_personalizados
   WHERE id = p_pedido_id;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Pedido personalizado #% no encontrado', p_pedido_id;
  END IF;

  v_estado := lower(btrim(COALESCE(NULLIF(p_estado, ''), v_existing.estado, 'pendiente')));
  IF v_estado NOT IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado personalizado inválido: %', p_estado;
  END IF;

  v_nombre := COALESCE(NULLIF(btrim(COALESCE(p_nombre_cliente, '')), ''), v_existing.nombre_cliente);
  v_tel := btrim(COALESCE(p_telefono, ''));
  v_email := NULLIF(btrim(COALESCE(p_email, '')), '');
  v_detalles := btrim(COALESCE(p_detalles, ''));

  IF v_nombre = '' OR v_tel = '' OR v_detalles = '' OR p_fecha_entrega IS NULL THEN
    RAISE EXCEPTION 'Nombre, teléfono, detalles y fecha de entrega son obligatorios';
  END IF;

  UPDATE public.pedidos_personalizados
     SET nombre_cliente = v_nombre,
         telefono = v_tel,
         email = v_email,
         producto_nombre = NULLIF(btrim(COALESCE(p_producto_nombre, '')), ''),
         producto_precio = CASE WHEN p_producto_precio IS NOT NULL AND p_producto_precio > 0 THEN p_producto_precio ELSE NULL END,
         detalles = v_detalles,
         colores = NULLIF(btrim(COALESCE(p_colores, '')), ''),
         tamano = NULLIF(btrim(COALESCE(p_tamano, '')), ''),
         extras = NULLIF(btrim(COALESCE(p_extras, '')), ''),
         fecha_entrega = p_fecha_entrega,
         hora_entrega = NULLIF(btrim(COALESCE(p_hora_entrega, '')), ''),
         estado = v_estado
   WHERE id = p_pedido_id;

  IF v_estado IS DISTINCT FROM v_existing.estado THEN
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
        COALESCE(v_email, v_existing.email),
        p_pedido_id,
        v_estado,
        v_notif_titulo,
        v_notif_mensaje,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_pedido_id, 'estado', v_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_actualizar_personalizado(BIGINT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_actualizar_personalizado(BIGINT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;

-- 3b. RPC: ELIMINAR PEDIDO PERMANENTEMENTE (EJ. PEDIDOS DE PRUEBA)
CREATE OR REPLACE FUNCTION public.admin_eliminar_pedido(
  p_pedido_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) THEN
    RAISE EXCEPTION 'Pedido #% no encontrado', p_pedido_id;
  END IF;

  BEGIN
    DELETE FROM public.notificaciones WHERE pedido_id = p_pedido_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  DELETE FROM public.pedidos WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'id', p_pedido_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_eliminar_pedido(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_pedido(BIGINT) TO authenticated;

-- 3c. RPC: ELIMINAR PEDIDO PERSONALIZADO PERMANENTEMENTE (EJ. PEDIDOS DE PRUEBA)
CREATE OR REPLACE FUNCTION public.admin_eliminar_personalizado(
  p_pedido_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pedidos_personalizados WHERE id = p_pedido_id) THEN
    RAISE EXCEPTION 'Pedido personalizado #% no encontrado', p_pedido_id;
  END IF;

  DELETE FROM public.pedidos_personalizados WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'id', p_pedido_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_eliminar_personalizado(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_personalizado(BIGINT) TO authenticated;

-- 4. DEDUPLICACIÓN AUTOMÁTICA POR TAG EN ADMIN_ALERTS (EVITA DUPLICADOS WEB + TRIGGERS)
CREATE OR REPLACE FUNCTION public.dedup_admin_alerts_by_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tag IS NOT NULL AND btrim(NEW.tag) <> '' THEN
    IF EXISTS (
      SELECT 1
        FROM public.admin_alerts a
       WHERE a.tag = NEW.tag
         AND a.created_at > (now() - INTERVAL '5 minutes')
    ) THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_alerts_dedup ON public.admin_alerts;
CREATE TRIGGER trg_admin_alerts_dedup
  BEFORE INSERT ON public.admin_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.dedup_admin_alerts_by_tag();

-- 5. TRIGGERS AUTOMÁTICOS EN SUPABASE PARA ALERTAS INMEDIATAS (FUNCIONAN INCLUSO SIN DEPLOY VERCEL)

-- 5a. Nuevo pedido tienda o agendado
CREATE OR REPLACE FUNCTION public.notify_admin_on_pedido_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origen TEXT := lower(btrim(COALESCE(NEW.origen, 'tienda')));
  v_cliente TEXT := COALESCE(NULLIF(btrim(NEW.cliente_nombre), ''), 'Cliente');
  v_total NUMERIC(10,2) := GREATEST(0, COALESCE(NEW.total, 0));
  v_tipo TEXT;
  v_titulo TEXT;
  v_tag TEXT;
BEGIN
  BEGIN
    IF v_origen IN ('tienda', 'web', '') THEN
      v_tipo := 'nuevo_pedido';
      v_titulo := 'Nuevo pedido web #' || NEW.id;
      v_tag := 'eh-pedido-' || NEW.id;
    ELSE
      v_tipo := 'pedido_agendado';
      v_titulo := 'Pedido agendado #' || NEW.id || ' (' || v_origen || ')';
      v_tag := 'eh-agendado-' || NEW.id;
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
      v_tipo,
      v_titulo,
      v_cliente || ' — S/ ' || to_char(v_total, 'FM999999990.00'),
      '/admin?seccion=pedidos&sub=pedidos',
      'pedidos',
      'pedidos',
      v_tag,
      jsonb_build_object('tipo', v_tipo, 'pedidoId', NEW.id, 'origen', v_origen)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_auto_admin_alert ON public.pedidos;
CREATE TRIGGER trg_pedidos_auto_admin_alert
  AFTER INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_pedido_insert();

-- 5b. Nuevo pedido personalizado
CREATE OR REPLACE FUNCTION public.notify_admin_on_personalizado_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente TEXT := COALESCE(NULLIF(btrim(NEW.nombre_cliente), ''), 'Cliente');
  v_prod TEXT := NULLIF(btrim(COALESCE(NEW.producto_nombre, '')), '');
BEGIN
  BEGIN
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
      'Nuevo pedido personalizado #' || NEW.id,
      v_cliente || COALESCE(' — ' || v_prod, '') ||
        COALESCE(' · Entrega: ' || to_char(NEW.fecha_entrega, 'DD/MM/YYYY'), ''),
      '/admin?seccion=pedidos&sub=personalizados',
      'pedidos',
      'personalizados',
      'eh-personalizado-' || NEW.id,
      jsonb_build_object('tipo', 'pedido_personalizado', 'pedidoId', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personalizados_auto_admin_alert ON public.pedidos_personalizados;
CREATE TRIGGER trg_personalizados_auto_admin_alert
  AFTER INSERT ON public.pedidos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_personalizado_insert();

-- 5c. Nueva suscripción newsletter
CREATE OR REPLACE FUNCTION public.notify_admin_on_suscriptor_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT := NULLIF(btrim(COALESCE(NEW.nombre, '')), '');
  v_email TEXT := btrim(COALESCE(NEW.email, ''));
BEGIN
  BEGIN
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
      'nuevo_suscriptor',
      'Nueva suscripción al newsletter',
      COALESCE(v_nombre || ' (' || v_email || ')', v_email),
      '/admin?seccion=clientes&sub=suscriptores',
      'clientes',
      'suscriptores',
      'eh-suscriptor-' || lower(v_email),
      jsonb_build_object('tipo', 'nuevo_suscriptor', 'email', v_email)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suscriptores_auto_admin_alert ON public.suscriptores;
CREATE TRIGGER trg_suscriptores_auto_admin_alert
  AFTER INSERT ON public.suscriptores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_suscriptor_insert();

-- 5d. Nuevo usuario registrado en profiles
CREATE OR REPLACE FUNCTION public.notify_admin_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT := COALESCE(lower(btrim(NEW.rol)), 'user');
  v_nombre TEXT := COALESCE(NULLIF(btrim(COALESCE(NEW.nombre, '')), ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Nuevo cliente');
  v_email TEXT := NULLIF(btrim(COALESCE(NEW.email, '')), '');
BEGIN
  IF v_rol = 'user' THEN
    BEGIN
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
        'nuevo_usuario',
        'Nuevo usuario registrado',
        COALESCE(v_nombre || ' (' || v_email || ')', v_nombre || ' se registró en Entre Hilos.'),
        '/admin?seccion=clientes&sub=usuarios',
        'clientes',
        'usuarios',
        'eh-new-user-' || NEW.id::text,
        jsonb_build_object('tipo', 'nuevo_usuario', 'userId', NEW.id, 'email', COALESCE(v_email, ''))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_admin_alert ON public.profiles;
CREATE TRIGGER trg_profiles_auto_admin_alert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_profile_insert();

NOTIFY pgrst, 'reload schema';
