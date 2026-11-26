const LIMA_OFFSET_SUFFIX = "-05:00";

export const DEFAULT_DELIVERY_TIME = "12:00";

const LIMA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Extrae la fecha calendario YYYY-MM-DD en hora de Perú (America/Lima).
 */
export function extractLimaDateOnly(fechaEntrega: unknown): string | null {
  if (fechaEntrega === null || fechaEntrega === undefined) return null;
  const raw = String(fechaEntrega).trim();
  if (!raw) return null;

  // Si ya viene como fecha calendario pura YYYY-MM-DD (ej. DATE en pedidos_personalizados)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Si viene como ISO con offset o timestamp completo, lo convertimos a fecha en America/Lima
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = LIMA_DATE_FORMATTER.formatToParts(parsed);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  }

  const head = raw.split("T")[0].split(" ")[0].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/**
 * Convierte texto libre de hora (24h, 12h AM/PM, rangos o palabras como "tarde")
 * a { hours, minutes }. Si es null/vacío o no reconocible, asume 12:00 p.m. hora Lima.
 */
export function parseLimaClockTime(horaEntrega?: string | null): { hours: number; minutes: number } {
  const defaultTime = { hours: 12, minutes: 0 };
  if (!horaEntrega || !String(horaEntrega).trim()) {
    return defaultTime;
  }

  const normalized = String(horaEntrega)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // 1. Buscar formato con am/pm primero (ej. "8:00 a.m.", "3:30 pm", "10am", "12:00 pm")
  const ampmMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = ampmMatch[2] ? Number(ampmMatch[2]) : 0;
    const isPm = ampmMatch[3].startsWith("p");

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      return { hours, minutes };
    }
  }

  // 2. Buscar formato 24h HH:MM (ej. "08:00", "15:30", "14:00 - 16:00" -> toma hora inicial)
  const h24Match = normalized.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (h24Match) {
    const hours = Number(h24Match[1]);
    const minutes = Number(h24Match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  // 3. Buscar número suelto con contexto de "h"/"hrs" (ej. "8h", "14h", "a las 16")
  const bareHourMatch = normalized.match(/(?:^|\b)(\d{1,2})\s*(?:h|hs|hrs)\b/);
  if (bareHourMatch) {
    const hours = Number(bareHourMatch[1]);
    if (hours >= 0 && hours <= 23) {
      return { hours, minutes: 0 };
    }
  }

  // 4. Palabras clave en español
  if (/\b(mediodia|medio\s*dia)\b/.test(normalized)) {
    return { hours: 12, minutes: 0 };
  }
  if (/\b(manana|temprano|am)\b/.test(normalized)) {
    return { hours: 9, minutes: 0 };
  }
  if (/\b(tarde|pm)\b/.test(normalized)) {
    return { hours: 14, minutes: 0 };
  }
  if (/\b(noche)\b/.test(normalized)) {
    return { hours: 19, minutes: 0 };
  }

  return defaultTime;
}

/**
 * Normaliza un valor cualquiera de hora al formato "HH:MM" para <input type="time">,
 * con predeterminado "12:00" (12:00 p.m.).
 */
export function toTimeInputValue(horaEntrega?: string | null): string {
  if (!horaEntrega || !String(horaEntrega).trim()) {
    return DEFAULT_DELIVERY_TIME;
  }
  const { hours, minutes } = parseLimaClockTime(horaEntrega);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Formatea una hora en reloj de 12 horas legible en español (ej. "8:00 a.m.", "12:00 p.m.").
 */
export function formatHora12h(horaEntrega?: string | null): string {
  const { hours, minutes } = parseLimaClockTime(horaEntrega);
  const suffix = hours < 12 ? "a.m." : "p.m.";
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * Construye el instante Date exacto de la entrega en zona horaria America/Lima (UTC-5).
 * Cuando `hora_entrega` es null o vacía, asume 12:00 p.m. hora Lima.
 */
export function parseDeliveryDateTimeLima(
  fechaEntrega: unknown,
  horaEntrega?: string | null
): Date | null {
  const dateOnly = extractLimaDateOnly(fechaEntrega);
  if (!dateOnly) return null;

  const { hours, minutes } = parseLimaClockTime(horaEntrega);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  const dt = new Date(`${dateOnly}T${hh}:${mm}:00${LIMA_OFFSET_SUFFIX}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Devuelve un resumen legible para notificaciones push en hora de Lima.
 */
export function formatDeliveryResumenLima(
  fechaEntrega: unknown,
  horaEntrega?: string | null
): string {
  const dateOnly = extractLimaDateOnly(fechaEntrega);
  if (!dateOnly) return "Fecha por confirmar";

  const [yyyy, mm, dd] = dateOnly.split("-");
  const horaLabel = formatHora12h(horaEntrega);
  return `${dd}/${mm}/${yyyy} · ${horaLabel}`;
}
