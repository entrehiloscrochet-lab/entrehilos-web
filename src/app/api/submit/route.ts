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

  let { error } = await supabaseAdmin.from(table).insert([data]);

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
