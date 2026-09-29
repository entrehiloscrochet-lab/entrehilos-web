-- Migración 024: Reemisión de los campos de entrega en perfiles de usuario
-- La 020 nunca llegó a aplicarse en la BD, por eso `profiles` no tenía estas
-- columnas y el guardado del perfil fallaba (incluido el teléfono de WhatsApp).
-- Es idempotente: aplicarla de nuevo no rompe nada.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provincia TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS distrito TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referencia TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS localidad TEXT;

COMMENT ON COLUMN public.profiles.telefono IS
  'Teléfono de contacto / WhatsApp. Se sugiere automáticamente en el checkout.';
COMMENT ON COLUMN public.profiles.direccion IS
  'Dirección exacta de entrega (calle, número, departamento).';
COMMENT ON COLUMN public.profiles.localidad IS
  'Localidad compuesta (distrito, provincia, departamento) para suggestions de entrega.';
