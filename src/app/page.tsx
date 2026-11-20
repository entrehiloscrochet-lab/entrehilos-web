import { getVentifyProducts } from "@/lib/ventify";
import HomeClient from "@/components/HomeClient";

export const revalidate = 60;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function getHomeSections() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await supabaseAdmin
      .from("home_sections")
      .select("*")
      .order("orden", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
}

interface HeroConfigRow {
  clave?: string;
  [key: string]: unknown;
}

async function getHeroConfig() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const heroKeys = ['home_hero_1', 'home_hero_2', 'home_hero_3', 'home_hero_4'];
    const { data } = await supabaseAdmin
      .from("hero_config")
      .select("*")
      .in("clave", heroKeys)
      .order("clave");
    if (!data) return [];
    return heroKeys.map(k => data.find((h: HeroConfigRow) => h.clave === k)).filter(Boolean);
  } catch {
    return [];
  }
}

async function getEventosHero() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data } = await supabaseAdmin
      .from("eventos")
      .select("*")
      .eq("activo", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [productsRes, sectionsRes, heroRes, eventosRes] = await Promise.allSettled([
    withTimeout(getVentifyProducts(), 5000, []),
    withTimeout(getHomeSections(), 5000, []),
    withTimeout(getHeroConfig(), 5000, []),
    withTimeout(getEventosHero(), 5000, []),
  ]);

  const products = productsRes.status === 'fulfilled' ? productsRes.value : [];
  const sections = sectionsRes.status === 'fulfilled' ? sectionsRes.value : [];
  const heroData = heroRes.status === 'fulfilled' ? heroRes.value : [];
  const eventosData = eventosRes.status === 'fulfilled' ? eventosRes.value : [];

  return <HomeClient products={products} sections={sections} heroData={heroData} eventosData={eventosData} />;
}
