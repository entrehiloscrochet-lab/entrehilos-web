import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { invalidateProductCaches } from "@/lib/ventify";
import { normalizarFechaEntrega } from "@/lib/fecha-entrega";

// Refresca las páginas cacheadas (ISR 5 min) cuando el admin cambia contenido,
// para que los cambios se vean al instante sin regenerar en cada visita.
function revalidateStorefront() {
  try {
    revalidatePath("/");
    revalidatePath("/personalizados");
  } catch {
    // fuera de request/next start no aplica
  }
}

interface EventoDbRow {
  slug: string;
  [key: string]: unknown;
}

interface SectionDbRow {
  section_key: string;
  [key: string]: unknown;
}

interface ProductoCatalogoRow {
  producto_id: unknown;
  sku: string | null;
  categoria_slug: string;
  incluir: boolean;
}

interface BulkCatalogItem {
  producto_id: string;
  sku?: string | null;
}

const TABLES: Record<string, string> = {
  suscriptores: "suscriptores",
  pedidos: "pedidos",
  mensajes: "mensajes_contacto",
  reclamaciones: "libro_reclamaciones",
  personalizados: "pedidos_personalizados",
  heroes: "hero_config",
  usuarios: "profiles",
  inicio: "home_sections",
  eventos: "eventos",
  catalogos: "eventos",
  resenas: "resenas",
  productos: "productos_inactivos",
  precios: "precios_tamanos",
  producto_catalogos: "producto_catalogos",
};

const ORDER_COLUMN: Record<string, string> = {
  heroes: "updated_at",
  inicio: "orden",
};

const DEFAULT_EVENTOS = [
  { id: -1, nombre: "Flores Amarillas", slug: "flores-amarillas", featured: true, activo: true },
  { id: -2, nombre: "Día de la Madre", slug: "dia-de-la-madre", featured: false, activo: true },
  { id: -3, nombre: "Día de la Mujer", slug: "dia-de-la-mujer", featured: false, activo: true },
  { id: -4, nombre: "Día de la Novia", slug: "dia-de-la-novia", featured: false, activo: true },
  { id: -5, nombre: "HotWheels", slug: "hotwheels", featured: false, activo: true },
  { id: -6, nombre: "Personalizados", slug: "personalizados", featured: false, activo: true },
  { id: -7, nombre: "San Valentín", slug: "san-valentin", featured: false, activo: true },
];

interface DirectoryClient {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  origen: "Manual" | "Registrado" | "Pedido";
}

function normalizeClientKey(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function upsertManualClientInHomeSections(client: {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}): Promise<DirectoryClient | null> {
  const cleanName = (client.nombre || "").trim();
  if (!cleanName) return null;
  const key = normalizeClientKey(cleanName);

  try {
    const { data: existingRow } = await supabaseAdmin
      .from("home_sections")
      .select("id, items")
      .eq("section_key", "clientes_manuales")
      .maybeSingle();

    const currentItems: Array<Record<string, unknown>> = Array.isArray(existingRow?.items)
      ? (existingRow.items as Array<Record<string, unknown>>)
      : [];

    const idx = currentItems.findIndex(
      (item) => normalizeClientKey(String(item?.nombre || "")) === key
    );

    const newEntry: DirectoryClient = {
      id: idx >= 0 && currentItems[idx].id ? String(currentItems[idx].id) : `cli_${Date.now()}`,
      nombre: cleanName,
      telefono: (client.telefono || (idx >= 0 ? String(currentItems[idx].telefono || "") : "")).trim() || undefined,
      email: (client.email || (idx >= 0 ? String(currentItems[idx].email || "") : "")).trim() || undefined,
      direccion: (client.direccion || (idx >= 0 ? String(currentItems[idx].direccion || "") : "")).trim() || undefined,
      origen: "Manual",
    };

    const updatedItems = [...currentItems];
    if (idx >= 0) {
      updatedItems[idx] = { ...currentItems[idx], ...newEntry };
    } else {
      updatedItems.unshift(newEntry as unknown as Record<string, unknown>);
    }

    if (existingRow?.id) {
      await supabaseAdmin
        .from("home_sections")
        .update({ items: updatedItems, updated_at: new Date().toISOString() })
        .eq("id", existingRow.id);
    } else {
      await supabaseAdmin.from("home_sections").insert({
        section_key: "clientes_manuales",
        tipo: "content",
        titulo: "Directorio de Clientes",
        items: updatedItems,
        orden: 999,
        activo: false,
      });
    }

    return newEntry;
  } catch (e) {
    console.warn("No se pudo guardar cliente manual en home_sections:", e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab") || "suscriptores";

  if (tab === "clientes-directorio") {
    const [profilesRes, pedidosRes, manualRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("pedidos")
        .select("cliente_nombre, cliente_telefono, cliente_email, direccion_envio")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("home_sections")
        .select("items")
        .eq("section_key", "clientes_manuales")
        .maybeSingle(),
    ]);

    const merged = new Map<string, DirectoryClient>();

    const addOrMerge = (entry: DirectoryClient) => {
      const cleanName = (entry.nombre || "").trim();
      if (!cleanName) return;
      const key = normalizeClientKey(cleanName);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...entry, nombre: cleanName });
      } else {
        merged.set(key, {
          ...existing,
          telefono: existing.telefono || entry.telefono,
          email: existing.email || entry.email,
          direccion: existing.direccion || entry.direccion,
        });
      }
    };

    // 1. Clientes manuales guardados
    const manualItems = Array.isArray(manualRes.data?.items) ? manualRes.data.items : [];
    for (const item of manualItems as Array<Record<string, unknown>>) {
      addOrMerge({
        id: String(item.id || `cli_${Math.random()}`),
        nombre: String(item.nombre || ""),
        telefono: item.telefono ? String(item.telefono) : undefined,
        email: item.email ? String(item.email) : undefined,
        direccion: item.direccion ? String(item.direccion) : undefined,
        origen: "Manual",
      });
    }

    // 2. Usuarios registrados en la web
    if (Array.isArray(profilesRes.data)) {
      for (const p of profilesRes.data as Array<Record<string, unknown>>) {
        const nombre = String(p.full_name || p.nombre || p.name || p.email || "").trim();
        addOrMerge({
          id: `prof_${p.id}`,
          nombre,
          telefono: p.phone ? String(p.phone) : p.telefono ? String(p.telefono) : undefined,
          email: p.email ? String(p.email) : undefined,
          direccion: p.direccion ? String(p.direccion) : undefined,
          origen: "Registrado",
        });
      }
    }

    // 3. Clientes que ya tienen pedidos (web o agendados)
    if (Array.isArray(pedidosRes.data)) {
      for (const ped of pedidosRes.data as Array<Record<string, unknown>>) {
        const nombre = String(ped.cliente_nombre || "").trim();
        const dir = ped.direccion_envio ? String(ped.direccion_envio) : undefined;
        addOrMerge({
          id: `ped_${normalizeClientKey(nombre)}`,
          nombre,
          telefono: ped.cliente_telefono ? String(ped.cliente_telefono) : undefined,
          email: ped.cliente_email ? String(ped.cliente_email) : undefined,
          direccion: dir && dir !== "Coordinar por WhatsApp" ? dir : undefined,
          origen: "Pedido",
        });
      }
    }

    const list = Array.from(merged.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
    return NextResponse.json(list);
  }

  const table = TABLES[tab];
  if (!table) return NextResponse.json({ error: "Invalid tab" }, { status: 400 });

  const orderCol = ORDER_COLUMN[tab] || "created_at";

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .order(orderCol, { ascending: false });

  if (error) {
    if (error.message?.includes("does not exist")) {
      console.warn(`Tabla '${table}' no existe aún.`);
      return NextResponse.json((tab === "eventos" || tab === "catalogos") ? DEFAULT_EVENTOS : []);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (tab === "eventos" || tab === "catalogos") {
    const dbEvents = data || [];
    const dbSlugs = new Set(dbEvents.map((e: EventoDbRow) => e.slug));
    const missingDefaults = DEFAULT_EVENTOS.filter((d) => !dbSlugs.has(d.slug));
    return NextResponse.json([...dbEvents, ...missingDefaults]);
  }

  if (tab === "inicio") {
    const sections = [...(data || [])].filter(
      (s: SectionDbRow) => s.section_key !== "clientes_manuales"
    );

    const hasProductosRotonda = sections.some((s: SectionDbRow) => s.section_key === "evento_productos_rotonda");
    if (!hasProductosRotonda) {
      const defaultProductosRotonda = {
        id: -98,
        section_key: "evento_productos_rotonda",
        tipo: "content",
        titulo: "Colección {evento}",
        subtitulo: "Catálogo Especial · {evento}",
        descripcion: "Descubre los ramos, arreglos y creaciones exclusivas tejidas a mano para celebrar en grande esta temporada.",
        items: {
          evento_slug: "auto",
          limite: 8,
        },
        orden: 0,
        activo: true,
      };
      sections.unshift(defaultProductosRotonda);
    }

    const hasRotonda = sections.some((s: SectionDbRow) => s.section_key === "campana_rotonda");
    if (!hasRotonda) {
      const defaultRotonda = {
        id: -99,
        section_key: "campana_rotonda",
        tipo: "content",
        titulo: "Así se vivieron nuestras campañas",
        subtitulo: "Momentos y Entregas Reales",
        descripcion: "Fotos de clientes y pedidos que llevaron felicidad en nuestras fechas más especiales.",
        items: [
          {
            imagen: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80",
            etiqueta: "Flores Amarillas",
            titulo: "Así floreció la alegría",
            descripcion: "Ramos eternos entregados con dedicatorias especiales a personas que iluminan la vida.",
          },
          {
            imagen: "/dia-de-la-madre-horizontal.png",
            etiqueta: "Día de la Madre",
            titulo: "Sonrisas inolvidables para Mamá",
            descripcion: "Cajas decoradas, tulipanes y detalles tejidos que celebraron al ser más especial.",
          },
          {
            imagen: "/Dia-de-la-mujer-8M.png",
            etiqueta: "Día de la Mujer 8M",
            titulo: "Conmemorando con amor y admiración",
            descripcion: "Hermosos arreglos entregados en colegios, empresas y familias en toda la región.",
          },
          {
            imagen: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80",
            etiqueta: "San Valentín",
            titulo: "Historias de amor tejidas a mano",
            descripcion: "Sorpresas románticas personalizadas que hicieron latir corazones más fuerte.",
          },
        ],
        orden: 1,
        activo: true,
      };
      sections.push(defaultRotonda);
    }
    return NextResponse.json(sections);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { action, id, updates: nestedUpdates, ...flatUpdates } = body;
  const updates =
    nestedUpdates && typeof nestedUpdates === "object" && !Array.isArray(nestedUpdates)
      ? nestedUpdates
      : flatUpdates;

  if (action === "marcar-leido") {
    const { error } = await supabaseAdmin
      .from("mensajes_contacto")
      .update({ leido: true })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "cambiar-estado") {
    const { data: pedidoData } = await supabaseAdmin
      .from("pedidos")
      .select("id, usuario_id, cliente_email, cliente_nombre")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("pedidos")
      .update({ estado: updates.estado })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (pedidoData) {
      try {
        const notifTitulo = updates.estado === "entregado" ? `Tu Pedido #${id} ha sido entregado`
          : updates.estado === "enviado" ? `Tu Pedido #${id} va en camino`
          : updates.estado === "confirmado" ? `Tu Pedido #${id} fue confirmado`
          : updates.estado === "cancelado" ? `Tu Pedido #${id} fue cancelado`
          : `Actualización de Pedido #${id}`;

        const notifMensaje = updates.estado === "entregado" ? "Tu detalle tejido a mano fue entregado con éxito. Gracias por confiar en Entre Hilos."
          : updates.estado === "enviado" ? "Tu pedido ha sido despachado y se encuentra en camino a tu dirección de entrega."
          : updates.estado === "confirmado" ? "Confirmamos tu pedido y estamos preparándolo en nuestro taller."
          : updates.estado === "cancelado" ? "Tu pedido ha sido cancelado. Si tienes alguna duda, escríbenos a soporte."
          : `El estado de tu pedido cambió a ${updates.estado}.`;

        await supabaseAdmin.from("notificaciones").insert([{
          usuario_id: pedidoData.usuario_id || null,
          email: pedidoData.cliente_email || null,
          pedido_id: id,
          tipo: updates.estado,
          titulo: notifTitulo,
          mensaje: notifMensaje,
          leido: false,
        }]);
      } catch (err) {
        // Ignorar si la tabla notificaciones no existe aún
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-pedido") {
    const {
      estado,
      adelanto,
      saldo_pendiente,
      metodo_pago,
      fecha_entrega,
      hora_entrega,
      cliente_nombre,
      cliente_telefono,
      direccion_envio,
      notas,
      fotos_entrega,
    } = updates;

    const { data: pedidoData } = await supabaseAdmin
      .from("pedidos")
      .select("id, usuario_id, cliente_email, cliente_nombre, estado, total, notas")
      .eq("id", id)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = {};
    if (estado !== undefined) updatePayload.estado = estado;
    if (adelanto !== undefined) updatePayload.adelanto = Number(adelanto);
    if (saldo_pendiente !== undefined) updatePayload.saldo_pendiente = Number(saldo_pendiente);
    if (metodo_pago !== undefined) updatePayload.metodo_pago = metodo_pago;
    if (cliente_nombre !== undefined && String(cliente_nombre).trim()) {
      updatePayload.cliente_nombre = String(cliente_nombre).trim();
    }
    if (cliente_telefono !== undefined) {
      updatePayload.cliente_telefono = String(cliente_telefono).trim();
    }
    if (direccion_envio !== undefined) {
      updatePayload.direccion_envio = String(direccion_envio).trim() || "Coordinar por WhatsApp";
    }
    if (fecha_entrega !== undefined) {
      updatePayload.fecha_entrega = normalizarFechaEntrega(fecha_entrega);
    }
    if (hora_entrega !== undefined) {
      const cleanHora = hora_entrega ? String(hora_entrega).trim() : null;
      updatePayload.hora_entrega = cleanHora || null;
    }
    if (notas !== undefined) {
      updatePayload.notas = notas ? String(notas).trim() : null;
    }

    const fotosEntregaLimpias =
      fotos_entrega !== undefined
        ? (Array.isArray(fotos_entrega) ? fotos_entrega : [])
            .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
            .map((f) => f.trim())
        : undefined;

    if (fotosEntregaLimpias !== undefined) {
      updatePayload.fotos_entrega = fotosEntregaLimpias;
    }

    let { error } = await supabaseAdmin
      .from("pedidos")
      .update(updatePayload)
      .eq("id", id);

    // Si la columna `fotos_entrega` aún no existe, reintentamos sin ella y
    // guardamos las fotos como marcador dentro de `notas` para no perderlas.
    if (error && updatePayload.fotos_entrega !== undefined) {
      const sinFotos = { ...updatePayload };
      delete sinFotos.fotos_entrega;

      const baseNotas = (notas !== undefined ? String(notas) : (pedidoData?.notas || ""))
        .replace(/\[Fotos Entrega:[^\]]*\]/gi, "")
        .replace(/\|\s*\|/g, "|")
        .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
        .trim();

      sinFotos.notas = [
        baseNotas,
        fotosEntregaLimpias && fotosEntregaLimpias.length > 0
          ? `[Fotos Entrega: ${fotosEntregaLimpias.join(" | ")}]`
          : null,
      ].filter(Boolean).join(" | ") || null;

      const retrySinFotos = await supabaseAdmin
        .from("pedidos")
        .update(sinFotos)
        .eq("id", id);
      error = retrySinFotos.error;
    }

    // Fallback si alguna columna aún no existe en Supabase (ej. fecha_entrega, adelanto)
    if (error) {
      console.warn("Reintentando actualizar pedido con fallback estándar:", error.message);
      const safePayload: Record<string, unknown> = {};
      if (updatePayload.estado) safePayload.estado = updatePayload.estado;
      if (updatePayload.metodo_pago) safePayload.metodo_pago = updatePayload.metodo_pago;
      if (updatePayload.cliente_telefono !== undefined) {
        safePayload.cliente_telefono = updatePayload.cliente_telefono;
      }

      const baseNotas = (notas !== undefined ? String(notas) : (pedidoData?.notas || ""))
        .replace(/\[Fotos Entrega:[^\]]*\]/gi, "")
        .replace(/\|\s*\|/g, "|")
        .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
        .trim();

      const fallbackNotas = [
        baseNotas,
        fecha_entrega ? `[Fecha Entrega: ${fecha_entrega} ${hora_entrega || ""}]` : null,
        adelanto !== undefined ? `[Adelanto: S/${adelanto} | Saldo: S/${saldo_pendiente}]` : null,
        fotosEntregaLimpias && fotosEntregaLimpias.length > 0
          ? `[Fotos Entrega: ${fotosEntregaLimpias.join(" | ")}]`
          : null,
      ].filter(Boolean).join(" | ");

      if (fallbackNotas) safePayload.notas = fallbackNotas;

      const retryRes = await supabaseAdmin
        .from("pedidos")
        .update(safePayload)
        .eq("id", id);
      error = retryRes.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (pedidoData && estado && estado !== pedidoData.estado) {
      try {
        const notifTitulo = estado === "entregado" ? `Tu Pedido #${id} ha sido entregado`
          : estado === "enviado" ? `Tu Pedido #${id} va en camino`
          : estado === "confirmado" ? `Tu Pedido #${id} fue confirmado`
          : estado === "cancelado" ? `Tu Pedido #${id} fue cancelado`
          : `Actualización de Pedido #${id}`;

        const notifMensaje = estado === "entregado" ? "Tu detalle tejido a mano fue entregado con éxito. Gracias por confiar en Entre Hilos."
          : estado === "enviado" ? "Tu pedido ha sido despachado y se encuentra en camino a tu dirección de entrega."
          : estado === "confirmado" ? "Confirmamos tu pedido y estamos preparándolo en nuestro taller."
          : estado === "cancelado" ? "Tu pedido ha sido cancelado. Si tienes alguna duda, escríbenos a soporte."
          : `El estado de tu pedido cambió a ${estado}.`;

        await supabaseAdmin.from("notificaciones").insert([{
          usuario_id: pedidoData.usuario_id || null,
          email: pedidoData.cliente_email || null,
          pedido_id: id,
          tipo: estado,
          titulo: notifTitulo,
          mensaje: notifMensaje,
          leido: false,
        }]);
      } catch (err) {
        // Ignorar si la tabla notificaciones no existe aún
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-hero") {
    const { error } = await supabaseAdmin
      .from("hero_config")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "personalizado-estado") {
    const { data: persData } = await supabaseAdmin
      .from("pedidos_personalizados")
      .select("id, email, nombre_cliente, producto_nombre")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("pedidos_personalizados")
      .update({ estado: updates.estado })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (persData) {
      try {
        const notifTitulo = updates.estado === "entregado" ? `Tu pedido personalizado ha sido entregado`
          : updates.estado === "listo" ? `Tu pedido personalizado está listo`
          : updates.estado === "en_produccion" ? `Tu pedido personalizado está en producción`
          : `Actualización de pedido personalizado`;

        const notifMensaje = updates.estado === "entregado" ? "Tu pedido personalizado fue entregado con éxito."
          : updates.estado === "listo" ? "Tu detalle personalizado está listo para coordinar la entrega."
          : updates.estado === "en_produccion" ? "Comenzamos a confeccionar tu pedido personalizado con dedicación."
          : `El estado de tu pedido personalizado cambió a ${updates.estado}.`;

        await supabaseAdmin.from("notificaciones").insert([{
          email: persData.email || null,
          pedido_id: id,
          tipo: updates.estado,
          titulo: notifTitulo,
          mensaje: notifMensaje,
          leido: false,
        }]);
      } catch (err) {
        // Ignorar si la tabla no existe aún
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-seccion") {
    if (!id || (typeof id === "number" && id < 0)) {
      const { error } = await supabaseAdmin
        .from("home_sections")
        .upsert({ ...updates, updated_at: new Date().toISOString() }, { onConflict: "section_key" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      revalidateStorefront();
      return NextResponse.json({ success: true });
    }
    const { error } = await supabaseAdmin
      .from("home_sections")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-evento") {
    if (updates.destacado_rotonda === true) {
      await supabaseAdmin.from("eventos").update({ destacado_rotonda: false }).eq("destacado_rotonda", true);
    }
    if (typeof id === "number" && id < 0) {
      const { error } = await supabaseAdmin
        .from("eventos")
        .upsert({ ...updates, updated_at: new Date().toISOString() }, { onConflict: "slug" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      revalidateStorefront();
      return NextResponse.json({ success: true });
    }
    const { error } = await supabaseAdmin
      .from("eventos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "destacar-rotonda-evento") {
    await supabaseAdmin.from("eventos").update({ destacado_rotonda: false }).eq("destacado_rotonda", true);
    const { error } = await supabaseAdmin
      .from("eventos")
      .update({ destacado_rotonda: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "destacar-evento") {
    const { error: err1 } = await supabaseAdmin
      .from("eventos")
      .update({ featured: false })
      .eq("featured", true);
    if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });

    if (typeof id === "number" && id < 0 && updates.slug) {
      await supabaseAdmin.from("eventos").upsert({ slug: updates.slug, nombre: updates.nombre || updates.slug, featured: true }, { onConflict: "slug" });
      revalidateStorefront();
      return NextResponse.json({ success: true });
    }

    const { error: err2 } = await supabaseAdmin
      .from("eventos")
      .update({ featured: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "eliminar-evento") {
    const { error } = await supabaseAdmin
      .from("eventos")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "aprobar-resena") {
    const { error } = await supabaseAdmin
      .from("resenas")
      .update({ aprobado: updates.aprobado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "eliminar-resena") {
    const { error } = await supabaseAdmin
      .from("resenas")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "set-producto-activo") {
    const { producto_id, activo } = updates;
    if (!producto_id) return NextResponse.json({ error: "producto_id requerido" }, { status: 400 });

    if (activo) {
      const { error } = await supabaseAdmin
        .from("productos_inactivos")
        .delete()
        .eq("producto_id", producto_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from("productos_inactivos")
        .upsert({ producto_id }, { onConflict: "producto_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    invalidateProductCaches();
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-precios-tamanos") {
    const { sku, precio_pequeno, precio_mediano, precio_grande } = updates;
    if (!sku) return NextResponse.json({ error: "sku requerido" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("precios_tamanos")
      .upsert(
        {
          sku,
          precio_pequeno: precio_pequeno ?? null,
          precio_mediano: precio_mediano ?? null,
          precio_grande: precio_grande ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "sku" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "guardar-producto-catalogos") {
    const { producto_id, sku, slugs_incluidos, slugs_excluidos } = updates;
    if (!producto_id) return NextResponse.json({ error: "producto_id requerido" }, { status: 400 });

    // 1. Eliminar asignaciones manuales previas de este producto
    await supabaseAdmin
      .from("producto_catalogos")
      .delete()
      .eq("producto_id", producto_id);

    const rowsToInsert: ProductoCatalogoRow[] = [];
    if (Array.isArray(slugs_incluidos)) {
      for (const slug of slugs_incluidos) {
        if (slug && typeof slug === "string") {
          rowsToInsert.push({
            producto_id,
            sku: sku || null,
            categoria_slug: slug.toLowerCase().trim(),
            incluir: true,
          });
        }
      }
    }

    if (Array.isArray(slugs_excluidos)) {
      for (const slug of slugs_excluidos) {
        if (slug && typeof slug === "string") {
          rowsToInsert.push({
            producto_id,
            sku: sku || null,
            categoria_slug: slug.toLowerCase().trim(),
            incluir: false,
          });
        }
      }
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from("producto_catalogos")
        .insert(rowsToInsert);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateProductCaches();
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "bulk-asignar-catalogos") {
    const { items, slug, operacion } = updates;
    if (!Array.isArray(items) || items.length === 0 || !slug) {
      return NextResponse.json({ error: "items y slug requeridos" }, { status: 400 });
    }

    const normalizedSlug = slug.toLowerCase().trim();

    if (operacion === "quitar") {
      for (const item of items) {
        await supabaseAdmin
          .from("producto_catalogos")
          .delete()
          .eq("producto_id", item.producto_id)
          .eq("categoria_slug", normalizedSlug);

        await supabaseAdmin
          .from("producto_catalogos")
          .upsert(
            {
              producto_id: item.producto_id,
              sku: item.sku || null,
              categoria_slug: normalizedSlug,
              incluir: false,
            },
            { onConflict: "producto_id,categoria_slug" }
          );
      }
    } else {
      const rows = items.map((item: BulkCatalogItem) => ({
        producto_id: item.producto_id,
        sku: item.sku || null,
        categoria_slug: normalizedSlug,
        incluir: true,
      }));

      const { error } = await supabaseAdmin
        .from("producto_catalogos")
        .upsert(rows, { onConflict: "producto_id,categoria_slug" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateProductCaches();
    revalidateStorefront();
    return NextResponse.json({ success: true });
  }

  if (action === "actualizar-producto") {
    const { producto } = updates || {};
    if (!producto || !producto.id) return NextResponse.json({ error: "producto e id requeridos" }, { status: 400 });
    const { saveProduct } = await import("@/lib/productos-db");
    const saved = await saveProduct(producto);
    revalidateStorefront();
    return NextResponse.json({ success: true, producto: saved });
  }

  if (action === "eliminar-producto") {
    const productoId = updates?.producto_id || id;
    if (!productoId) return NextResponse.json({ error: "producto_id requerido" }, { status: 400 });
    const { deleteProductsByIds } = await import("@/lib/productos-db");
    const result = await deleteProductsByIds([String(productoId)]);
    revalidateStorefront();
    return NextResponse.json({ success: true, ...result });
  }

  if (action === "eliminar-productos-masivo") {
    const productoIds = updates?.producto_ids;
    if (!Array.isArray(productoIds) || productoIds.length === 0) {
      return NextResponse.json({ error: "producto_ids requerido" }, { status: 400 });
    }
    const { deleteProductsByIds } = await import("@/lib/productos-db");
    const result = await deleteProductsByIds(productoIds.map(String));
    revalidateStorefront();
    return NextResponse.json({ success: true, ...result });
  }

  if (action === "actualizar-pedido-agendado") {
    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(updates)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, producto, clave, titulo, subtitulo, descripcion, badge, precio, producto_sku, tipo, imagen_url, imagen_url_mobile, link_url, nombre, slug, resena } = body;

  if (action === "guardar-cliente-manual") {
    const cliente = body.cliente || body;
    if (!cliente?.nombre || !String(cliente.nombre).trim()) {
      return NextResponse.json({ error: "Nombre del cliente requerido" }, { status: 400 });
    }
    const saved = await upsertManualClientInHomeSections({
      nombre: String(cliente.nombre),
      telefono: cliente.telefono ? String(cliente.telefono) : null,
      email: cliente.email ? String(cliente.email) : null,
      direccion: cliente.direccion ? String(cliente.direccion) : null,
    });
    return NextResponse.json({ success: true, cliente: saved });
  }

  if (action === "crear-producto" || action === "guardar-producto") {
    const prodData = producto || body;
    if (!prodData || !prodData.nombre || prodData.precio === undefined) {
      return NextResponse.json({ error: "Nombre y precio requeridos" }, { status: 400 });
    }
    const { saveProduct } = await import("@/lib/productos-db");
    const saved = await saveProduct(prodData);
    revalidateStorefront();
    return NextResponse.json({ success: true, producto: saved });
  }

  if (action === "agendar-pedido") {
    const {
      origen,
      cliente_nombre,
      cliente_telefono,
      cliente_email,
      direccion_envio,
      items,
      total,
      adelanto,
      saldo_pendiente,
      fecha_entrega,
      hora_entrega,
      metodo_pago,
      estado,
      notas,
    } = body;

    if (!cliente_nombre || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nombre de cliente e ítems son requeridos" }, { status: 400 });
    }

    const cleanFecha = normalizarFechaEntrega(fecha_entrega);
    const cleanHora = hora_entrega ? String(hora_entrega).trim() : null;
    const cleanNotas = notas ? String(notas).trim() : null;

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .insert({
        origen: origen || "whatsapp",
        cliente_nombre,
        cliente_telefono: cliente_telefono || "",
        cliente_email: cliente_email || null,
        direccion_envio: direccion_envio || "Coordinar por WhatsApp",
        items,
        total: Number(total) || 0,
        adelanto: Number(adelanto) || 0,
        saldo_pendiente: Number(saldo_pendiente) ?? Math.max(0, (Number(total) || 0) - (Number(adelanto) || 0)),
        fecha_entrega: cleanFecha || null,
        hora_entrega: cleanHora || null,
        metodo_pago: metodo_pago || "yape",
        estado: estado || "pendiente",
        notas: cleanNotas || null,
      })
      .select()
      .single();

    if (error) {
      console.warn("Reintentando pedido agendado con fallback a campos estándar:", error.message);
      const fallbackNotas = [
        notas,
        `[Origen: ${origen || 'whatsapp'}]`,
        fecha_entrega ? `[Fecha Entrega: ${fecha_entrega} ${hora_entrega || ''}]` : null,
        adelanto ? `[Adelanto: S/${adelanto} | Saldo: S/${saldo_pendiente}]` : null,
      ].filter(Boolean).join(" | ");

      const { data: fbData, error: fbError } = await supabaseAdmin
        .from("pedidos")
        .insert({
          cliente_nombre,
          cliente_telefono: cliente_telefono || "",
          cliente_email: cliente_email || null,
          direccion_envio: direccion_envio || "Coordinar por WhatsApp",
          items,
          total: Number(total) || 0,
          metodo_pago: metodo_pago || "yape",
          estado: estado || "pendiente",
          notas: fallbackNotas,
        })
        .select()
        .single();

      if (fbError) {
        return NextResponse.json({ error: fbError.message }, { status: 500 });
      }
      await upsertManualClientInHomeSections({
        nombre: cliente_nombre,
        telefono: cliente_telefono,
        email: cliente_email,
        direccion: direccion_envio !== "Coordinar por WhatsApp" ? direccion_envio : null,
      });
      return NextResponse.json({ success: true, data: fbData });
    }

    await upsertManualClientInHomeSections({
      nombre: cliente_nombre,
      telefono: cliente_telefono,
      email: cliente_email,
      direccion: direccion_envio !== "Coordinar por WhatsApp" ? direccion_envio : null,
    });
    return NextResponse.json({ success: true, data });
  }

  if (resena) {
    const { data, error } = await supabaseAdmin
      .from("resenas")
      .insert({
        producto_id: resena.producto_id,
        producto_sku: resena.producto_sku || null,
        producto_nombre: resena.producto_nombre || null,
        nombre_cliente: (resena.nombre_cliente || "Admin").toString().trim().slice(0, 60),
        calificacion: resena.calificacion,
        comentario: resena.comentario || null,
        aprobado: true,
        es_manual: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (clave) {
    const { data, error } = await supabaseAdmin
      .from("hero_config")
      .insert({
        clave,
        titulo: titulo || "",
        subtitulo: subtitulo || null,
        descripcion: descripcion || null,
        badge: badge || null,
        precio: precio || null,
        producto_sku: producto_sku || null,
        tipo: tipo || "flyer",
        imagen_url: imagen_url || "",
        imagen_url_mobile: imagen_url_mobile || null,
        link_url: link_url || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json(data);
  }

  if (nombre && slug) {
    const {
      descripcion,
      imagen_url,
      imagen_url_mobile,
      fecha_inicio,
      fecha_fin,
      mostrar_en_hero,
      activo,
      featured,
      destacado_rotonda,
      catalogo_url,
    } = body;

    if (featured) {
      await supabaseAdmin.from("eventos").update({ featured: false }).eq("featured", true);
    }
    if (destacado_rotonda) {
      await supabaseAdmin.from("eventos").update({ destacado_rotonda: false }).eq("destacado_rotonda", true);
    }

    const { data, error } = await supabaseAdmin
      .from("eventos")
      .insert({
        nombre,
        slug,
        descripcion: descripcion || null,
        imagen_url: imagen_url || null,
        imagen_url_mobile: imagen_url_mobile || null,
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        mostrar_en_hero: mostrar_en_hero !== false,
        activo: activo !== false,
        featured: Boolean(featured),
        destacado_rotonda: Boolean(destacado_rotonda),
        catalogo_url: catalogo_url || null,
        fotos_campana: body.fotos_campana || [],
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidateStorefront();
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "nombre and slug required" }, { status: 400 });
}
