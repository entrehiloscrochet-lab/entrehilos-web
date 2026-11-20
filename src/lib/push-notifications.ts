import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface AdminPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@entrehilos.pe";

  if (!publicKey || !privateKey) {
    console.warn(
      "[push-notifications] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY; no se pueden enviar Web Push."
    );
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

interface StoredPushSub {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envía una notificación Web Push a todos los dispositivos admin suscritos.
 * Funciona incluso cuando la APK/PWA está cerrada o en segundo plano.
 */
export async function sendAdminPushNotification(payload: AdminPushPayload): Promise<{
  sent: number;
  failed: number;
  total: number;
}> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const { data: subs, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("[push-notifications] Error leyendo suscripciones:", error.message);
    return { sent: 0, failed: 0, total: 0 };
  }

  const list = (subs ?? []) as StoredPushSub[];
  if (list.length === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const bodyJson = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/admin",
    tag: payload.tag || `eh-${Date.now()}`,
    data: payload.data || {},
  });

  const expiredEndpoints: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    list.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          bodyJson,
          {
            TTL: 60 * 60 * 24, // 24 horas
            urgency: "high",
          }
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn("[push-notifications] Fallo enviando a endpoint:", statusCode, err);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await supabaseAdmin
      .from("admin_push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  return { sent, failed, total: list.length };
}
