-- ============================================================
-- MIGRACIÓN 021: CATÁLOGO URL Y DESTACADO ROTONDA PARA EVENTOS
-- ============================================================

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS catalogo_url TEXT,
  ADD COLUMN IF NOT EXISTS destacado_rotonda BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.eventos.catalogo_url IS 'URL o archivo del catálogo oficial del evento para descarga directa de clientes';
COMMENT ON COLUMN public.eventos.destacado_rotonda IS 'Indica si este evento es el elegido para mostrar su galería rotonda 3D de fotos en la portada principal';
