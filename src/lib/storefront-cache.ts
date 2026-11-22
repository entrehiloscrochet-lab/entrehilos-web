// Caché en memoria del cliente (TTL 5 min) con deduplicación de promesas in-flight
// para evitar llamadas repetidas a /api/catalogos y /api/eventos desde Navbar,
// WhatsAppButton, EventoProductosRotondaSection y páginas de catálogo/evento.

export interface CatalogoClientItem {
  slug: string;
  label: string;
  tipo?: string;
  colorBadge?: string;
}

export interface CatalogosClientPayload {
  catalogos: CatalogoClientItem[];
  customSlugs: string[];
}

const CLIENT_STOREFRONT_TTL = 300_000;

let catalogosCache: CatalogosClientPayload | null = null;
let catalogosFetchedAt = 0;
let catalogosInFlight: Promise<CatalogosClientPayload | null> | null = null;

export async function fetchCatalogosClient(): Promise<CatalogosClientPayload | null> {
  const now = Date.now();
  if (catalogosCache && now - catalogosFetchedAt < CLIENT_STOREFRONT_TTL) {
    return catalogosCache;
  }
  if (catalogosInFlight) {
    return catalogosInFlight;
  }

  catalogosInFlight = (async () => {
    try {
      const res = await fetch("/api/catalogos");
      if (!res.ok) {
        catalogosInFlight = null;
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data?.catalogos)) {
        const payload: CatalogosClientPayload = {
          catalogos: data.catalogos,
          customSlugs: Array.isArray(data.customSlugs) ? data.customSlugs : [],
        };
        catalogosCache = payload;
        catalogosFetchedAt = Date.now();
        return payload;
      }
      catalogosInFlight = null;
      return null;
    } catch {
      catalogosInFlight = null;
      return null;
    } finally {
      if (!catalogosCache || Date.now() - catalogosFetchedAt >= CLIENT_STOREFRONT_TTL) {
        catalogosInFlight = null;
      }
    }
  })();

  return catalogosInFlight;
}

let eventosCache: unknown[] | null = null;
let eventosFetchedAt = 0;
let eventosInFlight: Promise<unknown[]> | null = null;

export async function fetchEventosClient<T = Record<string, unknown>>(): Promise<T[]> {
  const now = Date.now();
  if (eventosCache && now - eventosFetchedAt < CLIENT_STOREFRONT_TTL) {
    return eventosCache as T[];
  }
  if (eventosInFlight) {
    return eventosInFlight as Promise<T[]>;
  }

  eventosInFlight = (async () => {
    try {
      const res = await fetch("/api/eventos");
      if (!res.ok) {
        eventosInFlight = null;
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        eventosCache = data;
        eventosFetchedAt = Date.now();
        return data;
      }
      eventosInFlight = null;
      return [];
    } catch {
      eventosInFlight = null;
      return [];
    } finally {
      if (!eventosCache || Date.now() - eventosFetchedAt >= CLIENT_STOREFRONT_TTL) {
        eventosInFlight = null;
      }
    }
  })();

  return eventosInFlight as Promise<T[]>;
}
