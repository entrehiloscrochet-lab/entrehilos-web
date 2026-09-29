import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Columnas de datos de entrega que pueden faltar en la BD si la migracion
// 020_profile_shipping_fields.sql todavia no se aplico. El guardado nunca debe
// fallar por culpa de ellas: se omiten y se avisa, pero id/telefono/nombre/email
// (que son parte del esquema base) siempre se guardan.
const CAMPOS_ENVIO_OPCIONALES = [
  "direccion",
  "departamento",
  "provincia",
  "distrito",
  "referencia",
  "localidad",
];

type PostgrestError = { code?: string; message?: string } | null;

// PostgREST responde PGRST204 ("no encuentra la columna en el schema cache")
// o Postgres 42703 ("column does not exist") cuando el payload trae una
// columna inexistente.
function columnaInexistente(error: PostgrestError): string | null {
  if (!error) return null;
  const message = error.message || "";
  const esColumnaInvalida =
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /could not find the '.*' column|column .* does not exist/i.test(message);
  if (!esColumnaInvalida) return null;

  const conComillas = message.match(/'([^']+)'/);
  if (conComillas) return conComillas[1];
  const sinComillas = message.match(/column\s+\S*\.?(\w+)\s+does not exist/i);
  return sinComillas ? sinComillas[1] : null;
}

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

    // Intentar upsert con todos los campos. Si alguna columna de envio no existe
    // todavia en la BD, se omite y se reintenta en vez de perder todo el guardado.
    const payload: Record<string, any> = { ...updatesFull };
    const omitidos: string[] = [];

    for (let intento = 0; intento <= CAMPOS_ENVIO_OPCIONALES.length; intento++) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (!error) {
        return NextResponse.json({
          success: true,
          profile: payload,
          partial: omitidos.length > 0,
          campos_no_guardados: omitidos,
        });
      }

      const columna = columnaInexistente(error);
      if (!columna || !CAMPOS_ENVIO_OPCIONALES.includes(columna)) {
        console.error("Error guardando perfil en /api/perfil:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      delete payload[columna];
      omitidos.push(columna);
      console.warn(
        `Columna '${columna}' no existe en profiles: se omite y se reintenta el guardado.`
      );
    }

    return NextResponse.json({ error: "No se pudo guardar el perfil" }, { status: 500 });
  } catch (err: any) {
    console.error("Error in POST /api/perfil:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
