import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const [{ count: totalActiveCount }, { count: userActiveCount }] = await Promise.all([
    supabaseAdmin
      .from("admin_alert_devices")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabaseAdmin
      .from("admin_alert_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("active", true),
  ]);

  const activeDevices = totalActiveCount ?? 0;
  const userDevices = userActiveCount ?? 0;

  return NextResponse.json({
    activeDevices,
    userDevices,
    hasToken: activeDevices > 0,
    mode: "supabase-native",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const deviceId =
    typeof body?.deviceId === "string" && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 128)
      : "android-default";
  const platform =
    typeof body?.platform === "string" && body.platform.trim()
      ? body.platform.trim().toLowerCase().slice(0, 32)
      : "android";
  const deviceNameRaw =
    typeof body?.deviceName === "string"
      ? body.deviceName.trim()
      : request.headers.get("user-agent") || "";
  const deviceName = deviceNameRaw ? deviceNameRaw.slice(0, 200) : null;
  const appVersion =
    typeof body?.appVersion === "string" && body.appVersion.trim()
      ? body.appVersion.trim().slice(0, 64)
      : null;

  const deviceSecret = crypto.randomBytes(32).toString("hex");
  const secretHash = crypto.createHash("sha256").update(deviceSecret, "utf8").digest("hex");
  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabaseAdmin
    .from("admin_alert_devices")
    .upsert(
      {
        user_id: auth.user.id,
        device_id: deviceId,
        secret_hash: secretHash,
        platform,
        device_name: deviceName,
        app_version: appVersion,
        active: true,
        last_seen_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "device_id" }
    );

  if (upsertError) {
    console.error("[device-token] Error registrando dispositivo:", upsertError.message);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: latestAlert } = await supabaseAdmin
    .from("admin_alerts")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    deviceId,
    deviceSecret,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
    latestAlertId: Number(latestAlert?.id) || 0,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";

  if (!deviceId) {
    return NextResponse.json(
      { error: "deviceId requerido para desregistrar." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("admin_alert_devices")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("device_id", deviceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
