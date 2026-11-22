import { getVentifyProducts } from "@/lib/ventify";
import PersonalizadosContent from "@/components/personalizados/PersonalizadosClient";

// Se cachea 30 min (y se invalida on-demand desde el panel admin) para evitar
// regenerar en cada visita y consumir CPU gratuito de Vercel.
export const revalidate = 1800;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  promise.catch(() => {});
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

interface HomeSection {
  section_key?: string;
  items?: Record<string, string>;
  subtitulo?: string;
  imagen_url?: string;
}

async function getHomeSections() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await supabaseAdmin
      .from("home_sections")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .abortSignal(AbortSignal.timeout(4000));
    return data || [];
  } catch {
    return [];
  }
}

export default async function PersonalizadosPage() {
  const [productsRes, sectionsRes] = await Promise.allSettled([
    withTimeout(getVentifyProducts(), 5000, []),
    withTimeout(getHomeSections(), 5000, []),
  ]);

  const allProducts = productsRes.status === "fulfilled" ? productsRes.value : [];
  const sections = sectionsRes.status === "fulfilled" ? sectionsRes.value : [];

  const { isProductInSlug } = await import("@/lib/catalogos");
  const productosPersonalizados = allProducts.filter((p) => {
    // Usar catalogos pre-calculados si existen (incluye overrides manuales del admin)
    if (Array.isArray(p.catalogos) && p.catalogos.length > 0) {
      return p.catalogos.includes("personalizados");
    }
    // Fallback a reglas base por SKU
    return isProductInSlug(p, "personalizados");
  });

  const heroConfig = sections.find((s: HomeSection) => s.section_key === "personalizados_hero");

  return <PersonalizadosContent productosPersonalizados={productosPersonalizados} heroConfig={heroConfig} />;
}
