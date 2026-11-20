import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CATALOGOS_TIENDA, CatalogoDef } from "@/lib/catalogos";

export const dynamic = "force-dynamic";

const SECTION_KEY = "catalogos_tienda";

const BADGE_PALETTE = [
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-lime-50 text-lime-700 border-lime-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
];

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getCustomCatalogos(): Promise<CatalogoDef[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("home_sections")
      .select("items")
      .eq("section_key", SECTION_KEY)
      .maybeSingle();

    if (error || !data || !Array.isArray(data.items)) return [];

    return (data.items as Array<Record<string, unknown>>)
      .filter((item) => typeof item?.slug === "string" && typeof item?.label === "string")
      .map((item, idx) => ({
        slug: String(item.slug).toLowerCase().trim(),
        label: String(item.label).trim(),
        tipo: "catalogo" as const,
        colorBadge:
          typeof item.colorBadge === "string" && item.colorBadge
            ? item.colorBadge
            : BADGE_PALETTE[idx % BADGE_PALETTE.length],
      }));
  } catch {
    return [];
  }
}

async function saveCustomCatalogos(customCatalogos: CatalogoDef[]) {
  const { error } = await supabaseAdmin.from("home_sections").upsert(
    {
      section_key: SECTION_KEY,
      tipo: "content",
      titulo: "Catálogos de tienda personalizados",
      activo: false,
      orden: 999,
      items: customCatalogos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "section_key" }
  );
  if (error) throw error;
}

function mergeCatalogos(custom: CatalogoDef[]): CatalogoDef[] {
  const seen = new Set<string>(CATALOGOS_TIENDA.map((c) => c.slug));
  const merged = [...CATALOGOS_TIENDA];
  for (const c of custom) {
    if (!seen.has(c.slug)) {
      seen.add(c.slug);
      merged.push(c);
    }
  }
  return merged;
}

export async function GET() {
  const custom = await getCustomCatalogos();
  const catalogos = mergeCatalogos(custom);
  return NextResponse.json(
    {
      catalogos,
      customSlugs: custom.map((c) => c.slug),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const label = String(body?.label || body?.nombre || "").trim();
    if (!label) {
      return NextResponse.json({ error: "El nombre del catálogo es obligatorio" }, { status: 400 });
    }

    const slug = slugify(String(body?.slug || label));
    if (!slug) {
      return NextResponse.json({ error: "No se pudo generar un slug válido" }, { status: 400 });
    }

    const custom = await getCustomCatalogos();
    const allExisting = mergeCatalogos(custom);
    if (allExisting.some((c) => c.slug === slug)) {
      return NextResponse.json(
        { error: `Ya existe un catálogo con el identificador "${slug}"` },
        { status: 409 }
      );
    }

    const newCatalogo: CatalogoDef = {
      slug,
      label,
      tipo: "catalogo",
      colorBadge: BADGE_PALETTE[custom.length % BADGE_PALETTE.length],
    };

    const updatedCustom = [...custom, newCatalogo];
    await saveCustomCatalogos(updatedCustom);

    return NextResponse.json({
      ok: true,
      catalogo: newCatalogo,
      catalogos: mergeCatalogos(updatedCustom),
      customSlugs: updatedCustom.map((c) => c.slug),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear catálogo" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const slug = String(req.nextUrl.searchParams.get("slug") || "").toLowerCase().trim();
    if (!slug) {
      return NextResponse.json({ error: "Falta el parámetro slug" }, { status: 400 });
    }

    if (CATALOGOS_TIENDA.some((c) => c.slug === slug)) {
      return NextResponse.json(
        { error: "Los catálogos base de la tienda no se pueden eliminar" },
        { status: 400 }
      );
    }

    const custom = await getCustomCatalogos();
    const updatedCustom = custom.filter((c) => c.slug !== slug);
    await saveCustomCatalogos(updatedCustom);

    return NextResponse.json({
      ok: true,
      catalogos: mergeCatalogos(updatedCustom),
      customSlugs: updatedCustom.map((c) => c.slug),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar catálogo" },
      { status: 500 }
    );
  }
}
