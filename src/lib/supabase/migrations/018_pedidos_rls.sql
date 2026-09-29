-- MIGRACIÓN 018: RLS Y POLÍTICAS PARA TABLA PEDIDOS
-- Asegura que la tabla pedidos exista, tenga índices y permita lectura a sus dueños

CREATE TABLE IF NOT EXISTS public.pedidos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  usuario_id TEXT,
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT NOT NULL,
  cliente_email TEXT,
  direccion_envio TEXT,
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  metodo_pago TEXT,
  notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON public.pedidos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_email ON public.pedidos (cliente_email);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON public.pedidos (created_at);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Permitir insertar pedidos (desde el checkout web)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pedidos' AND policyname = 'Permitir insertar pedidos anonimo y auth'
  ) THEN
    CREATE POLICY "Permitir insertar pedidos anonimo y auth"
      ON public.pedidos FOR INSERT
      TO public, anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Permitir a usuarios ver sus propios pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pedidos' AND policyname = 'Usuarios ven sus propios pedidos'
  ) THEN
    CREATE POLICY "Usuarios ven sus propios pedidos"
      ON public.pedidos FOR SELECT
      TO authenticated
      USING (
        usuario_id = auth.uid()::text 
        OR cliente_email = auth.jwt()->>'email'
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = auth.uid() AND profiles.rol IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;
