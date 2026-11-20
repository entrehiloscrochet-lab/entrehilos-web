import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { sendAdminPushNotification } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createSupabaseServerClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.rol !== "admin" && profile?.rol !== "super_admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const result = await sendAdminPushNotification({
    title: "Entre Hilos - Prueba Push",
    body: "Las notificaciones en segundo plano están funcionando en este dispositivo.",
    url: "/admin",
    tag: `eh-test-${Date.now()}`,
  });

  return NextResponse.json({ success: true, ...result });
}
