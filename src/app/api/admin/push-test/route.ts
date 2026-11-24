import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendAdminPushNotification } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const result = await sendAdminPushNotification({
    title: "Entre Hilos Admin - Prueba de Alerta",
    body: "Alertas nativas Supabase activas. Recibirás avisos incluso con la app cerrada y pantalla bloqueada.",
    url: "/admin?seccion=pedidos&sub=pedidos",
    seccion: "pedidos",
    sub: "pedidos",
    tipo: "prueba",
    tag: `eh-test-${Date.now()}`,
  });

  return NextResponse.json({ success: true, ...result });
}
