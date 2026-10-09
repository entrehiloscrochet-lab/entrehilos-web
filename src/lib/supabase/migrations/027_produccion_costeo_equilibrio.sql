-- ============================================================
-- MIGRACIÓN 027: SISTEMA DE PRODUCCIÓN, COSTEO Y PUNTO DE EQUILIBRIO
-- Taller Artesanal y E-Commerce "Entre Hilos"
-- ============================================================

-- 1. TABLA DE CONFIGURACIÓN GLOBAL DE PRODUCCIÓN
CREATE TABLE IF NOT EXISTS public.produccion_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tarifa_hora NUMERIC(10,2) NOT NULL DEFAULT 8.00,
  margen_deseado_default NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  limite_horas_dia_alerta NUMERIC(5,2) NOT NULL DEFAULT 4.50,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.produccion_config (id, tarifa_hora, margen_deseado_default, limite_horas_dia_alerta)
VALUES ('default', 8.00, 40.00, 4.50)
ON CONFLICT (id) DO NOTHING;

-- 2. TABLA DE MATERIALES E INSUMOS (BOM - BILL OF MATERIALS)
CREATE TABLE IF NOT EXISTS public.produccion_materiales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Hilos', -- Hilos, Relleno, Fornituras, Packaging, Contenido Box, etc.
  presentacion TEXT DEFAULT '',
  precio_compra NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cantidad_total NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  unidad_medida TEXT NOT NULL DEFAULT 'unidades', -- gramos, pares, unidades, metros, etc.
  costo_unitario NUMERIC(10,4) NOT NULL DEFAULT 0.0000, -- Calculado: precio_compra / cantidad_total
  stock_actual NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produccion_materiales_cat ON public.produccion_materiales (categoria);

-- 3. TABLA DE PRODUCTOS Y ESCANDALLOS (RECETAS)
CREATE TABLE IF NOT EXISTS public.produccion_productos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  producto_tienda_id TEXT, -- Vinculación opcional con catálogo de tienda
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Amigurumis', -- Llaveros Impulso, Flores Eternas, Gift Boxes, etc.
  tiempo_produccion NUMERIC(5,2) NOT NULL DEFAULT 1.00, -- En horas decimales (ej. 1.25 hrs)
  precio_venta_real NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  margen_deseado NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  costo_materiales NUMERIC(10,2) DEFAULT 0.00,
  costo_mano_obra NUMERIC(10,2) DEFAULT 0.00,
  costo_total NUMERIC(10,2) DEFAULT 0.00,
  precio_sugerido NUMERIC(10,2) DEFAULT 0.00,
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA DETALLE DE RECETA: MATERIALES POR PRODUCTO
CREATE TABLE IF NOT EXISTS public.produccion_recetas_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  producto_id TEXT NOT NULL REFERENCES public.produccion_productos(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES public.produccion_materiales(id) ON DELETE RESTRICT,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1.00, -- ej. 25 gramos, 1 par de ojos
  costo_calculado NUMERIC(10,4) DEFAULT 0.0000,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recetas_producto ON public.produccion_recetas_items (producto_id);

-- 5. TABLA DE CAMPAÑAS Y FERIAS (PLANIFICACIÓN)
CREATE TABLE IF NOT EXISTS public.produccion_campanas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL, -- ej. "Feria San Clemente 2026", "Campaña Día de la Madre"
  descripcion TEXT DEFAULT '',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. METAS DE PRODUCCIÓN POR PRODUCTO EN CAMPAÑA
CREATE TABLE IF NOT EXISTS public.produccion_campana_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campana_id TEXT NOT NULL REFERENCES public.produccion_campanas(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES public.produccion_productos(id) ON DELETE CASCADE,
  cantidad_meta INTEGER NOT NULL DEFAULT 0,
  cantidad_terminada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campana_items_campana ON public.produccion_campana_items (campana_id);

-- 7. GASTOS FIJOS DEL EVENTO / FERIA (PARA PUNTO DE EQUILIBRIO)
CREATE TABLE IF NOT EXISTS public.produccion_campana_gastos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campana_id TEXT NOT NULL REFERENCES public.produccion_campanas(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL, -- ej. "Alquiler de Stand", "Movilidad / Flete", "Mantelería", "Publicidad", "Refrigerio"
  categoria TEXT NOT NULL DEFAULT 'Stand',
  monto NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campana_gastos_campana ON public.produccion_campana_gastos (campana_id);

-- 8. BITÁCORA DIARIA DE TEJIDO (REGISTRO DESDE SMARTPHONE)
CREATE TABLE IF NOT EXISTS public.produccion_bitacora (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  producto_id TEXT NOT NULL REFERENCES public.produccion_productos(id) ON DELETE CASCADE,
  campana_id TEXT REFERENCES public.produccion_campanas(id) ON DELETE SET NULL,
  piezas_terminadas INTEGER NOT NULL DEFAULT 1,
  horas_dedicadas NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  velocidad_piezas_hora NUMERIC(5,2) DEFAULT 1.00,
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON public.produccion_bitacora (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_producto ON public.produccion_bitacora (producto_id);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.produccion_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_recetas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_campana_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_campana_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_bitacora ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para administradores
DO $$
BEGIN
  CREATE POLICY "Admin full access produccion_config" ON public.produccion_config FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_materiales" ON public.produccion_materiales FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_productos" ON public.produccion_productos FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_recetas_items" ON public.produccion_recetas_items FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_campanas" ON public.produccion_campanas FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_campana_items" ON public.produccion_campana_items FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_campana_gastos" ON public.produccion_campana_gastos FOR ALL USING (true);
  CREATE POLICY "Admin full access produccion_bitacora" ON public.produccion_bitacora FOR ALL USING (true);
EXCEPTION WHEN others THEN
  -- Ignorar si las políticas ya existen
END $$;
