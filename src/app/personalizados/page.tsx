import { getVentifyProducts } from "@/lib/ventify";
import PersonalizadosContent from "@/components/personalizados/PersonalizadosClient";

export const dynamic = "force-dynamic";

async function getHomeSections() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await supabaseAdmin
      .from("home_sections")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
}

export default async function PersonalizadosPage() {
  const allProducts = await getVentifyProducts();
  const { isProductInSlug } = await import("@/lib/catalogos");
  const productosPersonalizados = allProducts.filter((p) => {
    // Usar catalogos pre-calculados si existen (incluye overrides manuales del admin)
    if (Array.isArray(p.catalogos) && p.catalogos.length > 0) {
      return p.catalogos.includes("personalizados");
    }
    // Fallback a reglas base por SKU
    return isProductInSlug(p, "personalizados");
  });

  const sections = await getHomeSections();
  const heroConfig = sections.find((s: any) => s.section_key === "personalizados_hero");

  return <PersonalizadosContent productosPersonalizados={productosPersonalizados} heroConfig={heroConfig} />;
}
