import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json({ error: "type and data are required" }, { status: 400 });
  }

  const TABLE_MAP: Record<string, string> = {
    pedido: "pedidos",
    mensaje: "mensajes_contacto",
    reclamacion: "libro_reclamaciones",
    personalizado: "pedidos_personalizados",
  };

  const table = TABLE_MAP[type];
  if (!table) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
  }

  if (type === "pedido" && data && typeof data === "object") {
    if (data.fecha_entrega !== undefined) {
      data.fecha_entrega = data.fecha_entrega ? String(data.fecha_entrega).split("T")[0].trim() : null;
    }
    if (data.hora_entrega !== undefined) {
      data.hora_entrega = data.hora_entrega ? String(data.hora_entrega).trim() : null;
    }
  }

  if (type === "personalizado" && data && typeof data === "object") {
    if (data.fecha_entrega !== undefined) {
      data.fecha_entrega = data.fecha_entrega ? String(data.fecha_entrega).split("T")[0].trim() : null;
    }
    if (data.hora_entrega !== undefined) {
      data.hora_entrega = data.hora_entrega ? String(data.hora_entrega).trim() : null;
    }
  }

  let { error } = await supabaseAdmin.from(table).insert([data]);

  // Si la columna hora_entrega aún no existe en pedidos_personalizados,
  // reintentamos sin ella para no perder la solicitud completa.
  if (
    error &&
    type === "personalizado" &&
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).hora_entrega !== undefined &&
    /hora_entrega/i.test(error.message)
  ) {
    const { hora_entrega, ...resto } = data as Record<string, unknown>;
    if (hora_entrega !== undefined) {
      console.warn("Reintentando pedido personalizado sin hora_entrega:", error.message);
      const retry = await supabaseAdmin.from(table).insert([resto]);
      error = retry.error;
    }
  }

  // Si es un pedido y falló posiblemente por columnas opcionales aún no migradas (fecha_entrega, etc.)
  if (error && type === "pedido") {
    console.warn("Reintentando inserción de pedido con fallback en notas:", error.message);
    const { fecha_entrega, hora_entrega, origen, notas, ...resto } = data;
    const fallbackNotas = [
      notas,
      fecha_entrega ? `[Fecha Entrega: ${fecha_entrega}${hora_entrega ? ` ${hora_entrega}` : ""}]` : null,
      origen ? `[Origen: ${origen}]` : null,
    ].filter(Boolean).join(" | ");

    const fallbackData = {
      ...resto,
      notas: fallbackNotas || null,
    };

    const retry = await supabaseAdmin.from(table).insert([fallbackData]);
    error = retry.error;
  }

  if (error) {
    console.error(`Error inserting ${type}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
