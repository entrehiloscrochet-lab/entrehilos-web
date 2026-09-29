-- Migración 023: Agregar campo para controlar visibilidad del botón flotante de catálogo
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS catalogo_boton_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.eventos.catalogo_boton_visible IS
  'Controla si el botón flotante circular de catálogo (encima del botón WhatsApp) se muestra en la tienda para este evento.';
