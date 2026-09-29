-- ============================================================
-- MIGRACIÓN 022: ASIGNACIÓN DE PRODUCTOS A MÚLTIPLES CATÁLOGOS Y EVENTOS
-- Permite que un producto se repita en varios catálogos (Ramos, Cajas,
-- HotWheels, Amigurumis, etc.) y eventos de temporada simultáneamente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.producto_catalogos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id TEXT NOT NULL,
  sku TEXT,
  categoria_slug TEXT NOT NULL,
  incluir BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_producto_catalogo UNIQUE (producto_id, categoria_slug)
);

CREATE INDEX IF NOT EXISTS idx_producto_catalogos_producto_id ON public.producto_catalogos (producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_catalogos_sku ON public.producto_catalogos (sku);
CREATE INDEX IF NOT EXISTS idx_producto_catalogos_slug ON public.producto_catalogos (categoria_slug);

COMMENT ON TABLE public.producto_catalogos IS 'Asignaciones de productos a múltiples catálogos y eventos para repetición flexible';
COMMENT ON COLUMN public.producto_catalogos.producto_id IS 'ID único de producto en Ventify';
COMMENT ON COLUMN public.producto_catalogos.sku IS 'SKU del producto para referencia y búsqueda rápida';
COMMENT ON COLUMN public.producto_catalogos.categoria_slug IS 'Slug del catálogo (ramos, cajas, amigurumis, hotwheels) o evento asignado';
COMMENT ON COLUMN public.producto_catalogos.incluir IS 'True si está incluido explícitamente, False si fue excluido de su regla por defecto';

ALTER TABLE public.producto_catalogos ENABLE ROW LEVEL SECURITY;

-- Acceso total para operaciones del servicio administrativo (API Admin)
CREATE POLICY "Service role full access producto_catalogos"
  ON public.producto_catalogos
  USING (true)
  WITH CHECK (true);

-- Lectura pública para clientes de la tienda y visitantes
CREATE POLICY "Public read producto_catalogos"
  ON public.producto_catalogos FOR SELECT
  USING (true);
