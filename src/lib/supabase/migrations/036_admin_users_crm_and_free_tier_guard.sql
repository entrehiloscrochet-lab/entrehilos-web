-- ============================================================================
-- MIGRACIÓN 036: CRM COMPLETO DE USUARIOS (REGISTRADOS + SIN CUENTA),
-- SINCRONIZACIÓN AUTOMÁTICA POR CORREO/TELÉFONO, ALERTAS DE REGISTRO Y
-- PROTECCIÓN DE LÍMITES SUPABASE FREE
-- Idempotente: segura aunque 035 se haya ejecutado o no (requiere 034+)
-- ============================================================================

-- 1. GARANTIZAR COLUMNAS E ÍNDICES DE RENDIMIENTO (MENOS CPU / EGRESS)
ALTER TABLE public.pedidos_personalizados
  ADD COLUMN IF NOT EXISTS hora_entrega TEXT;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fotos_entrega JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_tag_created
  ON public.admin_alerts (tag, created_at DESC)
  WHERE tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id
  ON public.pedidos (usuario_id)
  WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_email_lower
  ON public.pedidos (lower(btrim(cliente_email)))
  WHERE cliente_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_personalizados_email_lower
  ON public.pedidos_personalizados (lower(btrim(email)))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (lower(btrim(email)))
  WHERE email IS NOT NULL;

-- 2. TRIGGER DE AUTH -> PROFILES ROBUSTO E IDEMPOTENTE (EVITA FALLOS AL REGISTRAR)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- 3. SINCRONIZACIÓN AUTOMÁTICA DE PEDIDOS PREVIOS AL REGISTRAR O ACTUALIZAR PERFIL
CREATE OR REPLACE FUNCTION public.auto_sync_orders_on_profile_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(btrim(COALESCE(NEW.email, '')));
  v_tel_digits TEXT := regexp_replace(COALESCE(NEW.telefono, ''), '\D', '', 'g');
BEGIN
  BEGIN
    IF v_email <> '' THEN
      UPDATE public.pedidos
         SET usuario_id = NEW.id::text,
             cliente_email = COALESCE(NULLIF(btrim(cliente_email), ''), NEW.email)
       WHERE (usuario_id IS NULL OR btrim(usuario_id) = '')
         AND lower(btrim(COALESCE(cliente_email, ''))) = v_email;
    END IF;

    IF length(v_tel_digits) >= 9 THEN
      UPDATE public.pedidos
         SET usuario_id = NEW.id::text,
             cliente_email = COALESCE(
               NULLIF(btrim(cliente_email), ''),
               NULLIF(btrim(NEW.email), '')
             )
       WHERE (usuario_id IS NULL OR btrim(usuario_id) = '')
         AND regexp_replace(COALESCE(cliente_telefono, ''), '\D', '', 'g') = v_tel_digits;

      IF v_email <> '' THEN
        UPDATE public.pedidos_personalizados
           SET email = NEW.email
         WHERE NULLIF(btrim(COALESCE(email, '')), '') IS NULL
           AND regexp_replace(COALESCE(telefono, ''), '\D', '', 'g') = v_tel_digits;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_sync_orders ON public.profiles;
CREATE TRIGGER trg_profiles_auto_sync_orders
  AFTER INSERT OR UPDATE OF email, telefono ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_orders_on_profile_upsert();

-- 4. DEDUPLICACIÓN AUTOMÁTICA POR TAG EN ADMIN_ALERTS
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

-- 5. TRIGGERS AUTOMÁTICOS PARA ALERTAS INMEDIATAS (PEDIDOS, PERSONALIZADOS, SUSCRIPTORES, USUARIOS, MENSAJES, RECLAMOS)
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
      tipo, titulo, cuerpo, url, seccion, sub, tag, payload
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
      tipo, titulo, cuerpo, url, seccion, sub, tag, payload
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
      tipo, titulo, cuerpo, url, seccion, sub, tag, payload
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

CREATE OR REPLACE FUNCTION public.notify_admin_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT := COALESCE(NULLIF(lower(btrim(NEW.rol)), ''), 'user');
  v_nombre TEXT := COALESCE(
    NULLIF(btrim(COALESCE(NEW.nombre, '')), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Nuevo cliente'
  );
  v_email TEXT := NULLIF(btrim(COALESCE(NEW.email, '')), '');
BEGIN
  IF v_rol NOT IN ('admin', 'super_admin') THEN
    BEGIN
      INSERT INTO public.admin_alerts (
        tipo, titulo, cuerpo, url, seccion, sub, tag, payload
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

CREATE OR REPLACE FUNCTION public.notify_admin_on_mensaje_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT := COALESCE(NULLIF(btrim(NEW.nombre), ''), 'Visitante');
  v_asunto TEXT := NULLIF(btrim(COALESCE(NEW.asunto, '')), '');
BEGIN
  BEGIN
    INSERT INTO public.admin_alerts (
      tipo, titulo, cuerpo, url, seccion, sub, tag, payload
    )
    VALUES (
      'nuevo_mensaje',
      'Nuevo mensaje de contacto',
      v_nombre || COALESCE(' — ' || v_asunto, '') || COALESCE(': ' || LEFT(btrim(NEW.mensaje), 90), ''),
      '/admin?seccion=clientes&sub=mensajes',
      'clientes',
      'mensajes',
      'eh-mensaje-' || NEW.id,
      jsonb_build_object('tipo', 'nuevo_mensaje', 'mensajeId', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensajes_auto_admin_alert ON public.mensajes_contacto;
CREATE TRIGGER trg_mensajes_auto_admin_alert
  AFTER INSERT ON public.mensajes_contacto
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_mensaje_insert();

CREATE OR REPLACE FUNCTION public.notify_admin_on_reclamacion_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT := COALESCE(NULLIF(btrim(NEW.nombre_completo), ''), 'Cliente');
BEGIN
  BEGIN
    INSERT INTO public.admin_alerts (
      tipo, titulo, cuerpo, url, seccion, sub, tag, payload
    )
    VALUES (
      'nueva_reclamacion',
      'Nuevo ' || COALESCE(NEW.tipo, 'reclamo') || ' #' || NEW.id,
      v_nombre || ' — ' || COALESCE(NULLIF(btrim(NEW.producto_servicio), ''), LEFT(btrim(NEW.detalle), 90)),
      '/admin?seccion=clientes&sub=reclamaciones',
      'clientes',
      'reclamaciones',
      'eh-reclamo-' || NEW.id,
      jsonb_build_object('tipo', 'nueva_reclamacion', 'reclamoId', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reclamaciones_auto_admin_alert ON public.libro_reclamaciones;
CREATE TRIGGER trg_reclamaciones_auto_admin_alert
  AFTER INSERT ON public.libro_reclamaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_reclamacion_insert();

-- 6. RPCS DE EDICIÓN Y ELIMINACIÓN DE PEDIDOS (INCLUIDOS EN 035/036)
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
        usuario_id, email, pedido_id, tipo, titulo, mensaje, leido
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
        email, pedido_id, tipo, titulo, mensaje, leido
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

-- 7. NUEVOS RPCS CRM DE USUARIOS: ELIMINAR USUARIO Y VINCULAR / SINCRONIZAR CLIENTES SIN CUENTA
CREATE OR REPLACE FUNCTION public.admin_eliminar_usuario(
  p_target_user_id UUID,
  p_delete_orders BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target_rol TEXT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario objetivo requerido';
  END IF;

  IF p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador';
  END IF;

  SELECT lower(btrim(COALESCE(rol, 'user')))
    INTO v_target_rol
    FROM public.profiles
   WHERE id = p_target_user_id;

  IF v_target_rol IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF COALESCE(v_target_rol, 'user') IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'No se pueden eliminar cuentas con rol administrador';
  END IF;

  DELETE FROM public.wishlist WHERE usuario_id = p_target_user_id::text;
  DELETE FROM public.direcciones_envio WHERE usuario_id = p_target_user_id::text;
  DELETE FROM public.carritos_abandonados WHERE usuario_id = p_target_user_id::text;
  DELETE FROM public.notificaciones WHERE usuario_id = p_target_user_id::text;
  DELETE FROM public.admin_push_subscriptions WHERE user_id = p_target_user_id;
  DELETE FROM public.admin_device_tokens WHERE user_id = p_target_user_id;
  DELETE FROM public.admin_alert_devices WHERE user_id = p_target_user_id;

  IF COALESCE(p_delete_orders, false) THEN
    DELETE FROM public.pedidos WHERE usuario_id = p_target_user_id::text;
  ELSE
    UPDATE public.pedidos
       SET usuario_id = NULL
     WHERE usuario_id = p_target_user_id::text;
  END IF;

  DELETE FROM public.profiles WHERE id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_target_user_id,
    'deleted_orders', COALESCE(p_delete_orders, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_eliminar_usuario(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_usuario(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_vincular_pedidos_a_usuario(
  p_target_user_id UUID,
  p_match_nombre TEXT,
  p_match_telefono TEXT,
  p_match_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_name TEXT := lower(btrim(COALESCE(p_match_nombre, '')));
  v_tel TEXT := regexp_replace(COALESCE(p_match_telefono, ''), '\D', '', 'g');
  v_email TEXT := lower(btrim(COALESCE(p_match_email, '')));
  v_ped_count INT := 0;
  v_pers_count INT := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, email, telefono
    INTO v_prof
    FROM public.profiles
   WHERE id = p_target_user_id;

  IF v_prof.id IS NULL THEN
    RAISE EXCEPTION 'Cuenta de usuario destino no encontrada';
  END IF;

  IF v_name = '' AND length(v_tel) < 7 AND v_email = '' THEN
    RAISE EXCEPTION 'Indica nombre, teléfono o correo para identificar los pedidos';
  END IF;

  UPDATE public.pedidos
     SET usuario_id = p_target_user_id::text,
         cliente_email = COALESCE(NULLIF(btrim(cliente_email), ''), NULLIF(btrim(v_prof.email), ''))
   WHERE (usuario_id IS NULL OR btrim(usuario_id) = '')
     AND (
       (v_email <> '' AND lower(btrim(COALESCE(cliente_email, ''))) = v_email)
       OR (length(v_tel) >= 7 AND regexp_replace(COALESCE(cliente_telefono, ''), '\D', '', 'g') = v_tel)
       OR (v_name <> '' AND lower(btrim(COALESCE(cliente_nombre, ''))) = v_name)
     );
  GET DIAGNOSTICS v_ped_count = ROW_COUNT;

  IF NULLIF(btrim(COALESCE(v_prof.email, '')), '') IS NOT NULL THEN
    UPDATE public.pedidos_personalizados
       SET email = btrim(v_prof.email)
     WHERE (
       NULLIF(btrim(COALESCE(email, '')), '') IS NULL
       OR (v_email <> '' AND lower(btrim(email)) = v_email)
     )
       AND (
         (v_email <> '' AND lower(btrim(COALESCE(email, ''))) = v_email)
         OR (length(v_tel) >= 7 AND regexp_replace(COALESCE(telefono, ''), '\D', '', 'g') = v_tel)
         OR (v_name <> '' AND lower(btrim(COALESCE(nombre_cliente, ''))) = v_name)
       );
    GET DIAGNOSTICS v_pers_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'updated_pedidos', v_ped_count,
    'updated_personalizados', v_pers_count,
    'target_email', v_prof.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_vincular_pedidos_a_usuario(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_vincular_pedidos_a_usuario(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_asignar_correo_cliente(
  p_email TEXT,
  p_match_nombre TEXT,
  p_match_telefono TEXT,
  p_old_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_name TEXT := lower(btrim(COALESCE(p_match_nombre, '')));
  v_tel TEXT := regexp_replace(COALESCE(p_match_telefono, ''), '\D', '', 'g');
  v_old_email TEXT := lower(btrim(COALESCE(p_old_email, '')));
  v_existing_uid TEXT := NULL;
  v_ped_count INT := 0;
  v_pers_count INT := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Ingresa un correo electrónico válido';
  END IF;

  IF v_name = '' AND length(v_tel) < 7 AND v_old_email = '' THEN
    RAISE EXCEPTION 'Falta identificar el cliente (nombre, teléfono o correo anterior)';
  END IF;

  SELECT id::text
    INTO v_existing_uid
    FROM public.profiles
   WHERE lower(btrim(COALESCE(email, ''))) = v_new_email
   LIMIT 1;

  UPDATE public.pedidos
     SET cliente_email = v_new_email,
         usuario_id = COALESCE(NULLIF(btrim(usuario_id), ''), v_existing_uid)
   WHERE (usuario_id IS NULL OR btrim(usuario_id) = '')
     AND (
       (v_old_email <> '' AND lower(btrim(COALESCE(cliente_email, ''))) = v_old_email)
       OR (length(v_tel) >= 7 AND regexp_replace(COALESCE(cliente_telefono, ''), '\D', '', 'g') = v_tel)
       OR (v_name <> '' AND lower(btrim(COALESCE(cliente_nombre, ''))) = v_name)
     );
  GET DIAGNOSTICS v_ped_count = ROW_COUNT;

  UPDATE public.pedidos_personalizados
     SET email = v_new_email
   WHERE (
       (v_old_email <> '' AND lower(btrim(COALESCE(email, ''))) = v_old_email)
       OR (length(v_tel) >= 7 AND regexp_replace(COALESCE(telefono, ''), '\D', '', 'g') = v_tel)
       OR (v_name <> '' AND lower(btrim(COALESCE(nombre_cliente, ''))) = v_name)
     );
  GET DIAGNOSTICS v_pers_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_new_email,
    'linked_user_id', v_existing_uid,
    'updated_pedidos', v_ped_count,
    'updated_personalizados', v_pers_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_asignar_correo_cliente(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_asignar_correo_cliente(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 8. PROTECCIÓN ADICIONAL FREE TIER: PODA DE ALERTAS A 14 DÍAS
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
      'sent2h', 0
    );
  END IF;

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

DELETE FROM public.admin_alerts WHERE created_at < (now() - INTERVAL '14 days');

NOTIFY pgrst, 'reload schema';
