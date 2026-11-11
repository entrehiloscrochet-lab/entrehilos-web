-- ============================================================
-- MIGRACIÓN 028: FECHAS/HORAS DE ENTREGA Y RLS DE FORMULARIOS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. ASEGURAR COLUMNAS DE AGENDA EN PEDIDOS
--    (idempotente: no falla si ya existen)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_entrega TEXT;

CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON public.pedidos (fecha_entrega);

COMMENT ON COLUMN public.pedidos.fecha_entrega IS 'Fecha programada o agendada para la entrega del pedido';
COMMENT ON COLUMN public.pedidos.hora_entrega IS 'Horario/turno preferido para la entrega del pedido';

-- 2. HORA DE ENTREGA EN PEDIDOS PERSONALIZADOS
ALTER TABLE public.pedidos_personalizados
  ADD COLUMN IF NOT EXISTS hora_entrega TEXT;

COMMENT ON COLUMN public.pedidos_personalizados.hora_entrega IS 'Horario/turno preferido para la entrega del pedido personalizado';

-- 3. RLS: PERMITIR INSERTAR PEDIDOS PERSONALIZADOS DESDE LA WEB
--    El formulario público puede enviarse como anónimo o con sesión iniciada.
--    Sin esta política el insert falla con "row-level security policy" y el
--    pedido (con su fecha de entrega) nunca llega a guardarse.
ALTER TABLE public.pedidos_personalizados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pedidos_personalizados'
      AND policyname = 'Insertar pedidos personalizados publico'
  ) THEN
    CREATE POLICY "Insertar pedidos personalizados publico"
      ON public.pedidos_personalizados FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pedidos_personalizados'
      AND policyname = 'Leer pedidos personalizados solo autenticados'
  ) THEN
    CREATE POLICY "Leer pedidos personalizados solo autenticados"
      ON public.pedidos_personalizados FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
