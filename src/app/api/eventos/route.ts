import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Los eventos cambian muy poco: cachear 5 min en el CDN evita invocar la función
// en cada visita (el navbar y el botón de WhatsApp la consultan en todas las páginas).
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
};

interface EventoRow {
  slug: string;
  activo?: boolean;
  [key: string]: unknown;
}

export const DEFAULT_EVENTOS = [
  { id: -1, nombre: "Flores Amarillas", slug: "flores-amarillas", featured: true, activo: true },
  { id: -2, nombre: "Día de la Madre", slug: "dia-de-la-madre", featured: false, activo: true },
  { id: -3, nombre: "Día de la Mujer", slug: "dia-de-la-mujer", featured: false, activo: true },
  { id: -4, nombre: "Día de la Novia", slug: "dia-de-la-novia", featured: false, activo: true },
  { id: -5, nombre: "HotWheels", slug: "hotwheels", featured: false, activo: true },
  { id: -6, nombre: "Personalizados", slug: "personalizados", featured: false, activo: true },
  { id: -7, nombre: "San Valentín", slug: "san-valentin", featured: false, activo: true },
];

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("eventos")
      .select("*")
      .order("featured", { ascending: false })
      .order("nombre", { ascending: true })
      .abortSignal(AbortSignal.timeout(4000));

    const dbEvents = (data || []).filter((e: EventoRow) => e.activo !== false);

    // Si la BD no tiene algunos de los eventos predeterminados, los incorporamos
    const dbSlugs = new Set((data || []).map((e: EventoRow) => e.slug));
    const missingDefaults = DEFAULT_EVENTOS.filter((d) => !dbSlugs.has(d.slug));

    const allEventos = [...dbEvents, ...missingDefaults];

    return NextResponse.json(allEventos, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(DEFAULT_EVENTOS, { headers: CACHE_HEADERS });
  }
}
