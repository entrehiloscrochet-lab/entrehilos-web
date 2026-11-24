import { supabaseAdmin } from "@/lib/supabase/server";

export const ADMIN_ALERT_CHANNEL_ID = "entrehilos_admin_alerts";

export interface AdminPushPayload {
  title: string;
  body: string;
  url?: string;
  seccion?: string;
  sub?: string;
  tipo?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface AdminPushSendResult {
  sent: number;
  failed: number;
  total: number;
  alertId: number | null;
  configured: boolean;
}

function resolveSeccionSub(payload: AdminPushPayload): {
  url: string;
  seccion: string;
  sub: string;
} {
  const url =
    payload.url && payload.url.startsWith("/") ? payload.url : "/admin?seccion=pedidos&sub=pedidos";
  let seccion = payload.seccion?.trim() || "";
  let sub = payload.sub?.trim() || "";

  if (!seccion || !sub) {
    try {
      const parsed = new URL(url, "https://entrehilos.local");
      if (!seccion) seccion = parsed.searchParams.get("seccion") || "pedidos";
      if (!sub) sub = parsed.searchParams.get("sub") || "pedidos";
    } catch {
      if (!seccion) seccion = "pedidos";
      if (!sub) sub = "pedidos";
    }
  }

  return { url, seccion, sub };
}

/**
 * Registra una alerta nativa en `public.admin_alerts` dentro de Supabase.
 * El servicio nativo de la APK Android (`AdminAlertsForegroundService`)
 * consulta directamente Supabase y muestra la notificación con sonido y vibración.
 */
export async function sendAdminPushNotification(
  payload: AdminPushPayload
): Promise<AdminPushSendResult> {
  const { url, seccion, sub } = resolveSeccionSub(payload);
  const tipo = payload.tipo?.trim() || String(payload.data?.tipo || "general");

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("admin_alerts")
    .insert({
      tipo,
      titulo: payload.title,
      cuerpo: payload.body,
      url,
      seccion,
      sub,
      tag: payload.tag || null,
      payload: payload.data || {},
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[push-notifications] Error guardando alerta en admin_alerts:", insertError.message);
    return { sent: 0, failed: 1, total: 0, alertId: null, configured: true };
  }

  const { count, error: countError } = await supabaseAdmin
    .from("admin_alert_devices")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  if (countError) {
    console.warn("[push-notifications] Error contando admin_alert_devices:", countError.message);
  }

  const activeCount = count ?? 0;

  return {
    sent: activeCount,
    failed: 0,
    total: activeCount,
    alertId: typeof inserted?.id === "number" ? inserted.id : null,
    configured: true,
  };
}
