-- MIGRACIÓN 030: SUSCRIPCIONES WEB PUSH PARA ADMINISTRADORES (APK / PWA EN SEGUNDO PLANO)
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_user_id
  ON public.admin_push_subscriptions (user_id);

ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_push_subscriptions'
      AND policyname = 'Admins gestionan sus suscripciones push'
  ) THEN
    CREATE POLICY "Admins gestionan sus suscripciones push"
      ON public.admin_push_subscriptions FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.rol IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.rol IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;
