-- ============================================================================
-- MIGRACIÓN 031: NOTIFICACIONES PUSH NATIVAS (FCM) + RECORDATORIOS DE ENTREGA
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. TABLA DE TOKENS FCM POR DISPOSITIVO DE ADMINISTRADORES
CREATE TABLE IF NOT EXISTS public.admin_device_tokens (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  device_name TEXT,
  app_version TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_device_tokens_user_id
  ON public.admin_device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_device_tokens_user_device
  ON public.admin_device_tokens (user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_admin_device_tokens_active
  ON public.admin_device_tokens (active)
  WHERE active = true;

ALTER TABLE public.admin_device_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_device_tokens'
      AND policyname = 'Admins gestionan sus propios tokens FCM'
  ) THEN
    CREATE POLICY "Admins gestionan sus propios tokens FCM"
      ON public.admin_device_tokens FOR ALL
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

COMMENT ON TABLE public.admin_device_tokens IS 'Tokens nativos de Firebase Cloud Messaging (FCM) registrados desde la app Android admin.';

-- 2. BANDERAS DE DEDUPLICACIÓN PARA RECORDATORIOS DE ENTREGA (24H Y 2H)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS notified_24h_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_2h_at TIMESTAMPTZ;

ALTER TABLE public.pedidos_personalizados
  ADD COLUMN IF NOT EXISTS notified_24h_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_2h_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_upcoming_delivery_alerts
  ON public.pedidos (fecha_entrega)
  WHERE fecha_entrega IS NOT NULL
    AND estado NOT IN ('entregado', 'cancelado');

CREATE INDEX IF NOT EXISTS idx_pedidos_personalizados_upcoming_delivery_alerts
  ON public.pedidos_personalizados (fecha_entrega)
  WHERE fecha_entrega IS NOT NULL
    AND estado NOT IN ('entregado', 'cancelado');

-- Si se reprograma fecha_entrega o hora_entrega, limpiar banderas para volver a avisar
CREATE OR REPLACE FUNCTION public.reset_delivery_notification_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega)
     OR (NEW.hora_entrega IS DISTINCT FROM OLD.hora_entrega) THEN
    NEW.notified_24h_at := NULL;
    NEW.notified_2h_at := NULL;
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

-- 3. CRON EN SUPABASE (pg_cron + pg_net + Supabase Vault) CADA 15 MINUTOS
-- ============================================================================
-- CONFIGURACIÓN ÚNICA EN SUPABASE VAULT (ejecutar manualmente UNA vez en SQL Editor):
--
--   SELECT vault.create_secret('https://entrehilos-web.vercel.app', 'entrehilos_app_url');
--   SELECT vault.create_secret('<REEMPLAZAR_CON_TU_CRON_SECRET>', 'entrehilos_cron_secret');
--
-- Nota: El valor de 'entrehilos_cron_secret' debe coincidir exactamente con la variable
-- de entorno CRON_SECRET configurada en Vercel / .env.
-- Si alguna vez necesitas actualizar un secreto en Vault:
--   UPDATE vault.secrets SET secret = '<NUEVO_VALOR>' WHERE name = 'entrehilos_cron_secret';
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_upcoming_deliveries_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, net
AS $$
DECLARE
  v_app_url TEXT;
  v_cron_secret TEXT;
  v_endpoint TEXT;
BEGIN
  SELECT decrypted_secret
    INTO v_app_url
    FROM vault.decrypted_secrets
   WHERE name = 'entrehilos_app_url'
   LIMIT 1;

  SELECT decrypted_secret
    INTO v_cron_secret
    FROM vault.decrypted_secrets
   WHERE name = 'entrehilos_cron_secret'
   LIMIT 1;

  IF v_app_url IS NULL OR btrim(v_app_url) = '' THEN
    RAISE NOTICE '[entrehilos-cron] Falta secreto entrehilos_app_url en vault.secrets; omitiendo ejecución.';
    RETURN;
  END IF;

  IF v_cron_secret IS NULL OR btrim(v_cron_secret) = '' THEN
    RAISE NOTICE '[entrehilos-cron] Falta secreto entrehilos_cron_secret en vault.secrets; omitiendo ejecución.';
    RETURN;
  END IF;

  v_endpoint := rtrim(btrim(v_app_url), '/') || '/api/cron/upcoming-deliveries';

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(v_cron_secret)
    ),
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'triggered_at', now()
    ),
    timeout_milliseconds := 20000
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'entrehilos-upcoming-deliveries'
  ) THEN
    PERFORM cron.unschedule('entrehilos-upcoming-deliveries');
  END IF;
END $$;

SELECT cron.schedule(
  'entrehilos-upcoming-deliveries',
  '*/15 * * * *',
  $$SELECT public.trigger_upcoming_deliveries_cron();$$
);
