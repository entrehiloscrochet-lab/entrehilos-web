import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error reading profile in /api/perfil:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data || null });
  } catch (err: any) {
    console.error("Error in GET /api/perfil:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nombre, telefono, email, direccion, departamento, provincia, distrito, referencia, localidad } = body;

    if (!id) {
      return NextResponse.json({ error: "id de usuario requerido" }, { status: 400 });
    }

    const updatesFull: Record<string, any> = {
      id,
      nombre: nombre ? String(nombre).trim() : null,
      telefono: telefono ? String(telefono).trim() : null,
      email: email ? String(email).trim() : null,
      direccion: direccion ? String(direccion).trim() : null,
      departamento: departamento ? String(departamento).trim() : null,
      provincia: provincia ? String(provincia).trim() : null,
      distrito: distrito ? String(distrito).trim() : null,
      referencia: referencia ? String(referencia).trim() : null,
      localidad: localidad ? String(localidad).trim() : null,
      updated_at: new Date().toISOString(),
    };

    // Intentar upsert con todos los campos
    const { error: fullError } = await supabaseAdmin
      .from("profiles")
      .upsert(updatesFull, { onConflict: "id" });

    if (!fullError) {
      return NextResponse.json({ success: true, profile: updatesFull });
    }

    console.warn("Full profile upsert failed, retrying with core columns:", fullError.message);

    // Si falló por columnas que aún no existen en la BD, hacemos fallback con las columnas básicas
    const updatesCore: Record<string, any> = {
      id,
      nombre: updatesFull.nombre,
      telefono: updatesFull.telefono,
      email: updatesFull.email,
      direccion: updatesFull.direccion,
      updated_at: updatesFull.updated_at,
    };

    const { error: coreError } = await supabaseAdmin
      .from("profiles")
      .upsert(updatesCore, { onConflict: "id" });

    if (coreError) {
      console.error("Core profile upsert error:", coreError);
      return NextResponse.json({ error: coreError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: updatesFull, partial: true });
  } catch (err: any) {
    console.error("Error in POST /api/perfil:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
