import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient, supabaseAdmin } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { user: User; rol: "admin" | "super_admin"; error?: never }
  | { user?: never; rol?: never; error: NextResponse };

/**
 * Verifica que la petición provenga de un usuario autenticado con rol admin o super_admin.
 * Acepta sesión por cookies (@supabase/ssr) y Authorization: Bearer <jwt> como respaldo.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  let user: User | null = null;

  const response = NextResponse.next();
  const supabase = createSupabaseServerClient(request, response);
  const { data: cookieUserData } = await supabase.auth.getUser();
  user = cookieUserData.user ?? null;

  if (!user) {
    const authHeader = request.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      const { data: bearerUserData } = await supabaseAdmin.auth.getUser(match[1].trim());
      user = bearerUserData.user ?? null;
    }
  }

  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  const rol = profile?.rol;
  if (rol !== "admin" && rol !== "super_admin") {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  return { user, rol };
}
