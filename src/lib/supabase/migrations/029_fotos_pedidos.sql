-- Fotos de entrega de pedidos + bucket de almacenamiento para pedidos.
-- Ejecutar en el SQL Editor de Supabase.

-- 1) Columna para guardar las URLs de las fotos de entrega.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fotos_entrega JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pedidos.fotos_entrega IS 'URLs de las fotos tomadas/adjuntadas al entregar el pedido';

-- 2) Bucket público para fotos de pedidos (referencias y entregas).
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos', 'pedidos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) Políticas de acceso al bucket "pedidos".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pedidos_lectura_publica'
  ) THEN
    CREATE POLICY "pedidos_lectura_publica"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'pedidos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pedidos_subida'
  ) THEN
    CREATE POLICY "pedidos_subida"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'pedidos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pedidos_actualizacion'
  ) THEN
    CREATE POLICY "pedidos_actualizacion"
      ON storage.objects FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'pedidos')
      WITH CHECK (bucket_id = 'pedidos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pedidos_eliminacion'
  ) THEN
    CREATE POLICY "pedidos_eliminacion"
      ON storage.objects FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'pedidos');
  END IF;
END $$;
