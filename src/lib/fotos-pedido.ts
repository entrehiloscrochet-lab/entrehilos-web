/**
 * Lectura de las fotos de entrega de un pedido.
 *
 * Se guardan en la columna `fotos_entrega` (JSONB) cuando existe.
 * Si la columna todavía no ha sido creada en la base de datos, se usa un
 * marcador dentro de `notas`: `[Fotos Entrega: url1 | url2]`.
 */

const MARCADOR_FOTOS = /\[Fotos Entrega:\s*([^\]]*)\]/i;

function limpiarLista(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  if (typeof valor === "string" && valor.trim()) {
    try {
      const parsed = JSON.parse(valor);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
    } catch {
      // No era JSON
    }
  }
  return [];
}

export function parsearFotosEntrega(row: {
  fotos_entrega?: unknown;
  notas?: string | null;
} | null | undefined): string[] {
  if (!row) return [];

  const desdeColumna = limpiarLista(row.fotos_entrega);
  if (desdeColumna.length > 0) return desdeColumna;

  const notas = row.notas || "";
  const match = notas.match(MARCADOR_FOTOS);
  if (!match) return [];

  // Se usa "|" como separador para no romper las data URLs (que contienen comas).
  return match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function quitarMarcadorFotos(notas: string | null | undefined): string {
  return (notas || "")
    .replace(new RegExp(MARCADOR_FOTOS.source, "gi"), "")
    .replace(/\|\s*\|/g, "|")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();
}

export function construirMarcadorFotos(fotos: string[]): string {
  return `[Fotos Entrega: ${fotos.join(" | ")}]`;
}
