-- ============================================================================
-- MIGRACIÓN 032: ALERTAS NATIVAS 100% SUPABASE (SIN FIREBASE / SIN FCM)
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. BANDEJA DE ALERTAS PARA ADMINISTRADORES
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/admin',
  seccion TEXT NOT NULL DEFAULT 'pedidos',
  sub TEXT NOT NULL DEFAULT 'pedidos',
  tag TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at
  ON public.admin_alerts (created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_alerts'
      AND policyname = 'Admins leen alertas nativas'
  ) THEN
    CREATE POLICY "Admins leen alertas nativas"
      ON public.admin_alerts FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.rol IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- 2. DISPOSITIVOS ANDROID REGISTRADOS (SECRETO POR DISPOSITIVO SIN FIREBASE)
CREATE TABLE IF NOT EXISTS public.admin_alert_devices (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  device_name TEXT,
  app_version TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_alert_devices_user_id
  ON public.admin_alert_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_alert_devices_active
  ON public.admin_alert_devices (active)
  WHERE active = true;

ALTER TABLE public.admin_alert_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_alert_devices'
      AND policyname = 'Admins gestionan sus dispositivos de alertas'
  ) THEN
    CREATE POLICY "Admins gestionan sus dispositivos de alertas"
      ON public.admin_alert_devices FOR ALL
      TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.rol IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.rol IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- 3. RPC SEGURA PARA CONSULTA DIRECTA DESDE EL SERVICIO ANDROID EN SEGUNDO PLANO
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
   WHERE public.admin_alert_devices.id = v_device_pk;

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.tipo,
    a.titulo,
    a.cuerpo,
    a.url,
    a.seccion,
    a.sub,
    a.tag
  FROM public.admin_alerts a
  WHERE a.id > COALESCE(p_after_id, 0)
  ORDER BY a.id ASC
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.poll_admin_alerts(TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_admin_alerts(TEXT, TEXT, BIGINT) TO anon, authenticated;

COMMENT ON TABLE public.admin_alerts IS 'Cola de notificaciones nativas para la app Android Entre Hilos Admin (100% Supabase).';
COMMENT ON TABLE public.admin_alert_devices IS 'Dispositivos Android admin autorizados para recibir alertas desde Supabase sin Firebase.';
