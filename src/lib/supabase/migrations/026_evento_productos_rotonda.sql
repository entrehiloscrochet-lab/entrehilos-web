-- ============================================================
-- MIGRACIÓN 026: SECCIÓN ROTONDA 3D DE PRODUCTOS DEL EVENTO / CAMPAÑA ACTUAL
-- ============================================================

INSERT INTO public.home_sections (
  section_key,
  tipo,
  titulo,
  subtitulo,
  descripcion,
  items,
  orden,
  activo
) VALUES (
  'evento_productos_rotonda',
  'content',
  'Colección {evento}',
  'Catálogo Especial · {evento}',
  'Descubre los ramos, arreglos y creaciones exclusivas tejidas a mano para celebrar en grande esta temporada.',
  '{"evento_slug": "auto", "limite": 8}'::jsonb,
  0,
  true
)
ON CONFLICT (section_key) DO NOTHING;
