import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendAdminPushNotification } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  // Verificar que el usuario realmente existe en Supabase Auth y fue creado recientemente (últimos 5 min)
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const createdAtMs = new Date(data.user.created_at).getTime();
  if (Number.isNaN(createdAtMs) || Date.now() - createdAtMs > 5 * 60 * 1000) {
    return NextResponse.json({ skipped: true, reason: "not_new" });
  }

  const nombre =
    (data.user.user_metadata?.full_name as string | undefined)?.trim() ||
    (body?.nombre ? String(body.nombre).trim() : "") ||
    data.user.email?.split("@")[0] ||
    "Nuevo cliente";
  const email = data.user.email || "";

  const pushResult = await sendAdminPushNotification({
    title: "Nuevo usuario registrado",
    body: email ? `${nombre} (${email}) se registró en Entre Hilos.` : `${nombre} se registró en Entre Hilos.`,
    url: "/admin",
    tag: `eh-new-user-${userId}`,
    data: {
      tipo: "nuevo_usuario",
      userId,
      email,
    },
  });

  return NextResponse.json({ success: true, ...pushResult });
}
