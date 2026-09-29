import { NextResponse } from "next/server";
import { getAllVentifyProducts, getInactiveProductIds, getProductCatalogAssignments } from "@/lib/ventify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (e) {
    console.error("Error en proxy de productos Ventify:", e);
    return NextResponse.json(
      { error: "Error obteniendo productos", all: [], active: [], inactiveIds: [], assignments: [] },
      { status: 500 }
    );
  }
}