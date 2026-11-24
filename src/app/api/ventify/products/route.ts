import { NextRequest, NextResponse } from "next/server";
import { getAllVentifyProducts, getInactiveProductIds, getProductCatalogAssignments, invalidateProductCaches } from "@/lib/ventify";

// Respuesta cacheada en el CDN de Vercel durante 30 min (y navegador 5 min).
// Sin esto, cada visita a la tienda invocaba la función y consultaba Supabase.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
};

export async function GET(request: NextRequest) {
  // El panel admin usa ?fresh=1 para leer datos recién guardados sin esperar el CDN ni la caché en memoria.
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    if (fresh) {
      invalidateProductCaches();
    }
    const [all, inactiveIds, assignments] = await Promise.all([
      getAllVentifyProducts(),
      getInactiveProductIds(),
      getProductCatalogAssignments(),
    ]);
    const inactiveSet = new Set(inactiveIds);
    const active = inactiveIds.length === 0 ? all : all.filter((p) => !inactiveSet.has(p.id));
    return NextResponse.json(
      { all, active, inactiveIds, assignments },
      {
        headers: fresh ? { "Cache-Control": "no-store" } : CACHE_HEADERS,
      }
    );
  } catch (e) {
    console.error("Error en proxy de productos Ventify:", e);
    return NextResponse.json(
      { error: "Error obteniendo productos", all: [], active: [], inactiveIds: [], assignments: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
