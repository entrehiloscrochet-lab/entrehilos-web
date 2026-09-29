-- MIGRACIÓN 019: TABLA NOTIFICACIONES PARA USUARIOS
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  usuario_id TEXT,
  email TEXT,
  pedido_id BIGINT,
  tipo TEXT NOT NULL DEFAULT 'pedido',
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON public.notificaciones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_email ON public.notificaciones (email);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON public.notificaciones (created_at);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notificaciones' AND policyname = 'Usuarios ven sus notificaciones'
  ) THEN
    CREATE POLICY "Usuarios ven sus notificaciones"
      ON public.notificaciones FOR SELECT
      TO authenticated
      USING (
        usuario_id = auth.uid()::text 
        OR email = auth.jwt()->>'email'
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = auth.uid() AND profiles.rol IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;
