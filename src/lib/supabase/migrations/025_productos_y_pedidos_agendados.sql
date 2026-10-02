-- ============================================================
-- MIGRACIÓN 025: GESTIÓN PROPIA DE PRODUCTOS Y PEDIDOS AGENDADOS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. TABLA DE PRODUCTOS PROPIA (reemplaza dependencia de Ventify manteniendo todos los productos actuales)
CREATE TABLE IF NOT EXISTS public.productos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sku TEXT DEFAULT '',
  nombre TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_original NUMERIC(10,2),
  descripcion TEXT DEFAULT '',
  imagen TEXT DEFAULT '',
  imagenes JSONB DEFAULT '[]'::jsonb,
  categoria TEXT DEFAULT 'General',
  categoria_original TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  catalogos TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsqueda y filtrado eficiente
CREATE INDEX IF NOT EXISTS idx_productos_sku ON public.productos (sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON public.productos (categoria);
CREATE INDEX IF NOT EXISTS idx_productos_is_active ON public.productos (is_active);
CREATE INDEX IF NOT EXISTS idx_productos_created_at ON public.productos (created_at DESC);

-- Trigger para updated_at en productos
CREATE OR REPLACE FUNCTION update_productos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_updated_at ON public.productos;
CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_updated_at();

-- Habilitar RLS en productos
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para productos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'productos' AND policyname = 'Lectura publica productos'
  ) THEN
    CREATE POLICY "Lectura publica productos"
      ON public.productos FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'productos' AND policyname = 'Acceso total service_role productos'
  ) THEN
    CREATE POLICY "Acceso total service_role productos"
      ON public.productos FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. AMPLIAR TABLA PEDIDOS PARA PEDIDOS AGENDADOS Y EXTERNOS (WhatsApp, Facebook, etc.)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'tienda',
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_entrega TEXT,
  ADD COLUMN IF NOT EXISTS adelanto NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canal_contacto TEXT;

CREATE INDEX IF NOT EXISTS idx_pedidos_origen ON public.pedidos (origen);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON public.pedidos (fecha_entrega);

COMMENT ON TABLE public.productos IS 'Catálogo propio de productos de Entre Hilos';
COMMENT ON COLUMN public.pedidos.origen IS 'Canal de origen del pedido: tienda, whatsapp, facebook, instagram, tiktok, telefono, otro';
COMMENT ON COLUMN public.pedidos.fecha_entrega IS 'Fecha programada o agendada para la entrega del pedido';
COMMENT ON COLUMN public.pedidos.adelanto IS 'Monto abonado como seña o adelanto';
COMMENT ON COLUMN public.pedidos.saldo_pendiente IS 'Saldo pendiente de pago al momento de entrega';
