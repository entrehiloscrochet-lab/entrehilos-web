import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

interface PedidoRow {
  id: string | number;
  estado?: string | null;
  total?: number | string | null;
  items?: Array<{ nombre?: string }> | null;
  created_at: string;
  [key: string]: unknown;
}

interface PedidoPersonalizadoRow {
  id: string | number;
  estado?: string | null;
  producto_nombre?: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface Notificacion {
  id: string | number;
  pedido_id: string | number;
  tipo: string;
  titulo: string;
  mensaje: string;
  created_at: string;
  leido: boolean;
  es_personalizado?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");
    const anonId = searchParams.get("anonId");

    if (!userId && !email && !anonId) {
      return NextResponse.json({ pedidos: [], personalizados: [], notificaciones: [] });
    }

    // 1. Consultar pedidos
    let query = supabaseAdmin.from("pedidos").select("*");

    const conditions: string[] = [];
    if (userId) conditions.push(`usuario_id.eq.${userId}`);
    if (email) conditions.push(`cliente_email.eq.${email}`);
    if (anonId) conditions.push(`usuario_id.eq.${anonId}`);

    if (conditions.length > 0) {
      query = query.or(conditions.join(","));
    }

    const { data: pedidos, error: pedidosErr } = await query.order("created_at", { ascending: false });
    if (pedidosErr) {
      console.error("Error fetching pedidos in /api/mis-pedidos:", pedidosErr);
    }

    // 2. Consultar pedidos personalizados
    let personalizados: PedidoPersonalizadoRow[] = [];
    if (email) {
      const { data: persData, error: persErr } = await supabaseAdmin
        .from("pedidos_personalizados")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false });

      if (persErr) {
        console.error("Error fetching personalizados in /api/mis-pedidos:", persErr);
      } else {
        personalizados = persData || [];
      }
    }

    // 3. Consultar notificaciones almacenadas en BD (si existe la tabla)
    let notificacionesBd: Notificacion[] = [];
    try {
      const notifConds: string[] = [];
      if (userId) notifConds.push(`usuario_id.eq.${userId}`);
      if (email) notifConds.push(`email.eq.${email}`);

      if (notifConds.length > 0) {
        const { data: nData } = await supabaseAdmin
          .from("notificaciones")
          .select("*")
          .or(notifConds.join(","))
          .order("created_at", { ascending: false });
        if (Array.isArray(nData)) notificacionesBd = nData;
      }
    } catch {
      // Ignorar si la tabla notificaciones no existe aún
    }

    // 4. Generar notificaciones dinámicas inteligentes a partir de pedidos existentes
    // Esto garantiza que el usuario vea notificaciones de inmediato para pedidos que cambiaron de estado
    const notificacionesGeneradas: Notificacion[] = [];

    (pedidos || []).forEach((p: PedidoRow) => {
      const estado = (p.estado || "pendiente").toLowerCase();
      // Si el pedido está confirmado, enviado, entregado o cancelado
      if (["confirmado", "enviado", "entregado", "cancelado"].includes(estado)) {
        const itemNombre = Array.isArray(p.items) && p.items[0]?.nombre 
          ? p.items[0].nombre 
          : "tu compra";

        const titulo = estado === "entregado" ? `Tu Pedido #${p.id} ha sido entregado`
          : estado === "enviado" ? `Tu Pedido #${p.id} va en camino`
          : estado === "confirmado" ? `Tu Pedido #${p.id} fue confirmado`
          : `Pedido #${p.id} cancelado`;

        const mensaje = estado === "entregado" ? `Tu pedido con ${itemNombre} fue entregado con éxito. Gracias por confiar en Entre Hilos.`
          : estado === "enviado" ? `Tu pedido con ${itemNombre} ha sido despachado a tu dirección de envío.`
          : estado === "confirmado" ? `Confirmamos tu pedido por S/ ${Number(p.total).toFixed(2)}. Estamos preparándolo en nuestro taller.`
          : `Tu pedido #${p.id} fue cancelado. Si tienes dudas, contáctanos por WhatsApp.`;

        notificacionesGeneradas.push({
          id: `gen-p-${p.id}-${estado}`,
          pedido_id: p.id,
          tipo: estado,
          titulo,
          mensaje,
          created_at: p.created_at,
          leido: false,
          es_personalizado: false,
        });
      }
    });

    personalizados.forEach((p: PedidoPersonalizadoRow) => {
      const estado = (p.estado || "pendiente").toLowerCase();
      if (["confirmado", "en_produccion", "listo", "entregado", "cancelado"].includes(estado)) {
        const titulo = estado === "entregado" ? `Tu pedido personalizado ha sido entregado`
          : estado === "listo" ? `Tu pedido personalizado está listo`
          : estado === "en_produccion" ? `Tu pedido personalizado está en producción`
          : estado === "confirmado" ? `Pedido personalizado confirmado`
          : `Pedido personalizado cancelado`;

        const mensaje = estado === "entregado" ? `Tu pedido (${p.producto_nombre || 'personalizado'}) fue entregado con éxito.`
          : estado === "listo" ? `Tu detalle personalizado (${p.producto_nombre || 'hecho a mano'}) ya está listo.`
          : estado === "en_produccion" ? `Comenzamos a confeccionar tu pedido personalizado con dedicación.`
          : `Actualización de estado en tu pedido personalizado.`;

        notificacionesGeneradas.push({
          id: `gen-pers-${p.id}-${estado}`,
          pedido_id: p.id,
          tipo: estado,
          titulo,
          mensaje,
          created_at: p.created_at,
          leido: false,
          es_personalizado: true,
        });
      }
    });

    // Unir ambas listas evitando duplicados exactos
    const combinadas = [...notificacionesBd];
    notificacionesGeneradas.forEach((gen) => {
      const yaExiste = combinadas.some(
        (b) => b.pedido_id === gen.pedido_id && b.tipo === gen.tipo
      );
      if (!yaExiste) combinadas.push(gen);
    });

    combinadas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      pedidos: pedidos || [],
      personalizados,
      notificaciones: combinadas,
    });
  } catch (err: unknown) {
    console.error("Error in /api/mis-pedidos:", err);
    return NextResponse.json({ error: (err as { message?: string }).message }, { status: 500 });
  }
}
