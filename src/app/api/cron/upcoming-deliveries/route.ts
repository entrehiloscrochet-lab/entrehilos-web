import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendAdminPushNotification } from "@/lib/push-notifications";
import {
  formatDeliveryResumenLima,
  parseDeliveryDateTimeLima,
} from "@/lib/delivery-schedule";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const PAST_GRACE_MS = 30 * 60 * 1000;

interface DeliveryRow {
  id: number | string;
  estado?: string | null;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  notified_24h_at?: string | null;
  notified_2h_at?: string | null;
  cliente_nombre?: string | null;
  nombre_cliente?: string | null;
  producto_nombre?: string | null;
  total?: number | string | null;
}

function timingSafeBearerMatch(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !expectedSecret) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;

  const provided = Buffer.from(match[1].trim(), "utf8");
  const expected = Buffer.from(expectedSecret.trim(), "utf8");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

async function authorizeCronOrAdmin(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET?.trim() || "";
  const authHeader = request.headers.get("authorization");

  if (cronSecret && timingSafeBearerMatch(authHeader, cronSecret)) {
    return null;
  }

  const adminAuth = await requireAdmin(request);
  if (!adminAuth.error) {
    return null;
  }

  return NextResponse.json(
    { error: "No autorizado para ejecutar el cron de entregas." },
    { status: 401 }
  );
}

function formatRemainingText(msRemaining: number): string {
  if (msRemaining <= 0) return "ahora";
  const totalMinutes = Math.round(msRemaining / 60_000);
  if (totalMinutes < 60) return `en ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `en ${hours}h ${mins}m` : `en ${hours}h`;
}

async function processDeliveryTable(params: {
  table: "pedidos" | "pedidos_personalizados";
  sub: "pedidos" | "personalizados";
  selectCols: string;
  nowMs: number;
  nowIso: string;
}): Promise<{ checked: number; sent24h: number; sent2h: number; error?: string }> {
  const { table, sub, selectCols, nowMs, nowIso } = params;

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(selectCols)
    .not("fecha_entrega", "is", null)
    .or("notified_24h_at.is.null,notified_2h_at.is.null");

  if (error) {
    console.error(`[cron/upcoming-deliveries] Error consultando ${table}:`, error.message);
    return { checked: 0, sent24h: 0, sent2h: 0, error: `${table}: ${error.message}` };
  }

  const rows = (data ?? []) as unknown as DeliveryRow[];
  let checked = 0;
  let sent24h = 0;
  let sent2h = 0;

  for (const row of rows) {
    const estado = String(row.estado || "").trim().toLowerCase();
    if (estado === "entregado" || estado === "cancelado") {
      continue;
    }

    const deliveryDate = parseDeliveryDateTimeLima(row.fecha_entrega, row.hora_entrega);
    if (!deliveryDate) continue;

    checked++;
    const msRemaining = deliveryDate.getTime() - nowMs;
    const cliente =
      String(row.cliente_nombre || row.nombre_cliente || "Cliente").trim() || "Cliente";
    const resumen = formatDeliveryResumenLima(row.fecha_entrega, row.hora_entrega);
    const tipoLabel = sub === "personalizados" ? "Pedido personalizado" : "Pedido";
    const extraInfo =
      sub === "personalizados" && row.producto_nombre
        ? ` (${String(row.producto_nombre).trim()})`
        : Number.isFinite(Number(row.total)) && Number(row.total) > 0
          ? ` (S/ ${Number(row.total).toFixed(2)})`
          : "";

    const targetUrl = `/admin?seccion=pedidos&sub=${sub}`;

    // Ventana 2h (incluye hasta 30 min de margen pasado para no perder entregas por desfase del cron)
    if (msRemaining <= TWO_HOURS_MS && msRemaining >= -PAST_GRACE_MS && !row.notified_2h_at) {
      const tiempoTxt = formatRemainingText(msRemaining);
      const pushRes = await sendAdminPushNotification({
        title: `Entrega muy próxima (${tiempoTxt})`,
        body: `${tipoLabel} #${row.id} de ${cliente}${extraInfo} — ${resumen}`,
        url: targetUrl,
        seccion: "pedidos",
        sub,
        tipo: "entrega_2h",
        tag: `eh-entrega-2h-${table}-${row.id}`,
        data: {
          pedidoId: row.id,
          tabla: table,
          ventana: "2h",
        },
      });

      if (pushRes.sent > 0) {
        const { error: updateErr } = await supabaseAdmin
          .from(table)
          .update({
            notified_2h_at: nowIso,
            notified_24h_at: row.notified_24h_at || nowIso,
          })
          .eq("id", row.id);

        if (updateErr) {
          console.error(`[cron/upcoming-deliveries] Error actualizando ${table}#${row.id}:`, updateErr.message);
        } else {
          sent2h++;
        }
      }
      continue;
    }

    // Ventana 24h (entre 2h y 24h antes de la entrega)
    if (msRemaining > TWO_HOURS_MS && msRemaining <= TWENTY_FOUR_HOURS_MS && !row.notified_24h_at) {
      const tiempoTxt = formatRemainingText(msRemaining);
      const pushRes = await sendAdminPushNotification({
        title: `Entrega programada (${tiempoTxt})`,
        body: `${tipoLabel} #${row.id} de ${cliente}${extraInfo} — ${resumen}`,
        url: targetUrl,
        seccion: "pedidos",
        sub,
        tipo: "entrega_24h",
        tag: `eh-entrega-24h-${table}-${row.id}`,
        data: {
          pedidoId: row.id,
          tabla: table,
          ventana: "24h",
        },
      });

      if (pushRes.sent > 0) {
        const { error: updateErr } = await supabaseAdmin
          .from(table)
          .update({ notified_24h_at: nowIso })
          .eq("id", row.id);

        if (updateErr) {
          console.error(`[cron/upcoming-deliveries] Error actualizando ${table}#${row.id}:`, updateErr.message);
        } else {
          sent24h++;
        }
      }
    }
  }

  return { checked, sent24h, sent2h };
}

async function handleCron(request: NextRequest) {
  const authError = await authorizeCronOrAdmin(request);
  if (authError) return authError;

  // Preferir la función nativa en Postgres (0 egress extra) si la migración 033 ya fue aplicada
  try {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "check_upcoming_deliveries_alerts"
    );
    if (!rpcError && rpcData && typeof rpcData === "object") {
      return NextResponse.json({
        source: "postgres_rpc",
        ...(rpcData as Record<string, unknown>),
      });
    }
  } catch {
    // Fallback al flujo TypeScript si la RPC aún no existe
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const [pedidosRes, persRes] = await Promise.all([
    processDeliveryTable({
      table: "pedidos",
      sub: "pedidos",
      selectCols:
        "id, cliente_nombre, total, estado, fecha_entrega, hora_entrega, notified_24h_at, notified_2h_at",
      nowMs,
      nowIso,
    }),
    processDeliveryTable({
      table: "pedidos_personalizados",
      sub: "personalizados",
      selectCols:
        "id, nombre_cliente, producto_nombre, estado, fecha_entrega, hora_entrega, notified_24h_at, notified_2h_at",
      nowMs,
      nowIso,
    }),
  ]);

  const errors = [pedidosRes.error, persRes.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors,
        checkedPedidos: pedidosRes.checked,
        checkedPersonalizados: persRes.checked,
        sent24h: pedidosRes.sent24h + persRes.sent24h,
        sent2h: pedidosRes.sent2h + persRes.sent2h,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    checkedAt: nowIso,
    checkedPedidos: pedidosRes.checked,
    checkedPersonalizados: persRes.checked,
    sent24h: pedidosRes.sent24h + persRes.sent24h,
    sent2h: pedidosRes.sent2h + persRes.sent2h,
  });
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}
