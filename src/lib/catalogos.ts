// Utilidades y definiciones para la asignación y repetición de productos en múltiples catálogos y eventos

export interface ProductoCatalogoAssignment {
  id?: number;
  producto_id: string;
  sku?: string | null;
  categoria_slug: string;
  incluir: boolean;
  created_at?: string;
}

export interface CatalogoDef {
  slug: string;
  label: string;
  tipo: 'catalogo' | 'evento';
  colorBadge: string;
}

// Catálogos principales fijos de la tienda
export const CATALOGOS_TIENDA: CatalogoDef[] = [
  { slug: 'ramos', label: 'Ramos', tipo: 'catalogo', colorBadge: 'bg-pink-50 text-[#C04267] border-pink-200' },
  { slug: 'amigurumis', label: 'Amigurumis', tipo: 'catalogo', colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { slug: 'cajas', label: 'Cajas', tipo: 'catalogo', colorBadge: 'bg-sky-50 text-sky-700 border-sky-200' },
  { slug: 'hotwheels', label: 'HotWheels', tipo: 'catalogo', colorBadge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { slug: 'personalizados', label: 'Personalizados', tipo: 'catalogo', colorBadge: 'bg-purple-50 text-purple-700 border-purple-200' },
];

// Eventos predeterminados del sistema
export const EVENTOS_BASE: CatalogoDef[] = [
  { slug: 'flores-amarillas', label: 'Flores Amarillas', tipo: 'evento', colorBadge: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { slug: 'san-valentin', label: 'San Valentín', tipo: 'evento', colorBadge: 'bg-rose-50 text-rose-700 border-rose-200' },
  { slug: 'dia-de-la-madre', label: 'Día de la Madre', tipo: 'evento', colorBadge: 'bg-red-50 text-red-700 border-red-200' },
  { slug: 'dia-de-la-mujer', label: 'Día de la Mujer', tipo: 'evento', colorBadge: 'bg-violet-50 text-violet-700 border-violet-200' },
  { slug: 'dia-de-la-novia', label: 'Día de la Novia', tipo: 'evento', colorBadge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  { slug: 'hotwheels', label: 'HotWheels (Evento)', tipo: 'evento', colorBadge: 'bg-orange-50 text-orange-800 border-orange-200' },
];

/**
 * Determina los slugs por defecto de un producto según sus reglas base preexistentes
 * (SKU, nombre, categoría de Ventify) para asegurar 100% de compatibilidad hacia atrás.
 */
export function getDefaultProductSlugs(p: {
  sku?: string;
  nombre?: string;
  categoriaOriginal?: string | null;
}): string[] {
  const slugs = new Set<string>();
  const sku = (p.sku || '').trim();
  const skuLower = sku.toLowerCase();
  const name = (p.nombre || '').toLowerCase();
  const catOrig = (p.categoriaOriginal || '').toLowerCase();

  // 1. Ramos (Ramos-*, Ramo-*, Flores-*, o mención en nombre/categoría)
  if (
    skuLower.startsWith('ramo') ||
    skuLower.startsWith('mujer-') ||
    skuLower.startsWith('madre-') ||
    skuLower.startsWith('flores-') ||
    name.includes('ramo') ||
    catOrig.includes('ramo') ||
    catOrig.includes('flores')
  ) {
    slugs.add('ramos');
  }

  // 2. Amigurumis
  if (skuLower.startsWith('amigu-') || catOrig.includes('amigurumi') || catOrig.includes('muñeco')) {
    slugs.add('amigurumis');
  }

  // 3. Cajas (cualquier Caja-*, caja-*, o mención a box, caja, cajita)
  if (
    skuLower.startsWith('caja-') ||
    name.includes('caja') ||
    name.includes('cajita') ||
    name.includes('box') ||
    catOrig.includes('caja')
  ) {
    slugs.add('cajas');
  }

  // 4. HotWheels (Catálogo y Evento)
  if (
    skuLower.startsWith('cua-') ||
    skuLower.startsWith('carr-') ||
    skuLower.startsWith('hw-') ||
    ['caja-004', 'caja-005', 'caja-012', 'caja-018', 'caja-022'].includes(skuLower) ||
    catOrig.includes('hotwheels') ||
    name.includes('hotwheels')
  ) {
    slugs.add('hotwheels');
  }

  // 5. Personalizados
  if (skuLower.startsWith('amigu-') || skuLower.startsWith('carr-') || catOrig.includes('personalizado') || name.includes('personalizado')) {
    slugs.add('personalizados');
  }

  // 6. Eventos específicos por defecto según categoría original o nombre
  if (skuLower.startsWith('mujer-') || name.includes('mujer') || catOrig.includes('mujer')) {
    slugs.add('dia-de-la-mujer');
  }
  if (
    (skuLower.startsWith('ramo') || ['caja-001', 'caja-002', 'caja-003'].includes(skuLower)) &&
    (catOrig.includes('san valentin') || catOrig.includes('san valentín') || catOrig.includes('novia'))
  ) {
    slugs.add('san-valentin');
    slugs.add('dia-de-la-novia');
  }
  if (
    skuLower.startsWith('madre-') ||
    catOrig.includes('madre') ||
    name.includes('madre') ||
    name.includes('mamá')
  ) {
    slugs.add('dia-de-la-madre');
  }
  if (
    catOrig.includes('flores amarillas') ||
    name.includes('flores amarillas') ||
    skuLower.startsWith('flores-')
  ) {
    slugs.add('flores-amarillas');
  }

  return Array.from(slugs);
}

/**
 * Devuelve todos los slugs activos (combinando defaults + inclusiones/exclusiones manuales en BD)
 */
export function getProductActiveSlugs(
  p: {
    id?: string;
    sku?: string;
    nombre?: string;
    categoriaOriginal?: string | null;
  },
  assignments: ProductoCatalogoAssignment[] = []
): string[] {
  const activeSlugs = new Set<string>(getDefaultProductSlugs(p));

  const productAssignments = assignments.filter((a) => {
    if (p.id && a.producto_id === p.id) return true;
    if (p.sku && a.sku && a.sku.toLowerCase() === p.sku.toLowerCase()) return true;
    return false;
  });

  productAssignments.forEach((assign) => {
    const slug = assign.categoria_slug.toLowerCase().trim();
    if (assign.incluir) {
      activeSlugs.add(slug);
    } else {
      activeSlugs.delete(slug);
    }
  });

  return Array.from(activeSlugs);
}

/**
 * Consulta si un producto pertenece a un catálogo o evento específico.
 * Da prioridad absoluta a assignments si se proporcionan.
 */
export function isProductInSlug(
  p: {
    id?: string;
    sku?: string;
    nombre?: string;
    categoriaOriginal?: string | null;
    catalogos?: string[];
  },
  slug: string,
  assignments?: ProductoCatalogoAssignment[]
): boolean {
  if (!slug) return false;
  const target = slug.toLowerCase().trim();

  // Si se pasaron asignaciones explícitas de BD, calcular siempre con ellas
  if (assignments && assignments.length > 0) {
    const active = getProductActiveSlugs(p, assignments);
    return active.includes(target);
  }

  // Si ya tiene el array de catálogos calculado, comprobarlo directamente
  if (Array.isArray(p.catalogos)) {
    return p.catalogos.includes(target);
  }

  if (assignments) {
    const active = getProductActiveSlugs(p, assignments);
    return active.includes(target);
  }

  // Fallback a defaults
  return getDefaultProductSlugs(p).includes(target);
}

/**
 * Obtiene la etiqueta y estilo de distintivo para un slug
 */
export function getSlugBadgeInfo(
  slug: string,
  allEventos: Array<{ slug?: string; nombre?: string; label?: string }> = []
): { label: string; colorClass: string; isEvent: boolean } {
  const normalized = slug.toLowerCase().trim();

  const tiendaMatch = CATALOGOS_TIENDA.find((c) => c.slug === normalized);
  if (tiendaMatch) {
    return {
      label: tiendaMatch.label,
      colorClass: tiendaMatch.colorBadge,
      isEvent: false,
    };
  }

  const eventoBase = EVENTOS_BASE.find((e) => e.slug === normalized);
  if (eventoBase) {
    return {
      label: eventoBase.label,
      colorClass: eventoBase.colorBadge,
      isEvent: true,
    };
  }

  const dbEvento = allEventos.find((e) => (e.slug || '').toLowerCase().trim() === normalized);
  if (dbEvento) {
    return {
      label: dbEvento.nombre || slug,
      colorClass: 'bg-pink-50 text-[#C04267] border-pink-200',
      isEvent: true,
    };
  }

  // Etiqueta capitalizada genérica
  const capitalized = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
  return {
    label: capitalized,
    colorClass: 'bg-gray-100 text-gray-700 border-gray-200',
    isEvent: false,
  };
}
