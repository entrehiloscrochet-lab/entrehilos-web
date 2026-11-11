/**
 * Las fechas de entrega son fechas de calendario (sin hora real).
 * La columna `pedidos.fecha_entrega` es TIMESTAMPTZ, así que si se guarda
 * solo "YYYY-MM-DD" queda a medianoche UTC y al mostrarla en Perú (UTC-5)
 * retrocede un día (12 nov → 11 nov).
 *
 * Anclamos la fecha a las 12:00 del mediodía en Perú para que cualquier
 * conversión de zona horaria siga mostrando el mismo día calendario.
 */
export function normalizarFechaEntrega(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnly = raw.split("T")[0].split(" ")[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly || null;

  return `${dateOnly}T12:00:00-05:00`;
}
