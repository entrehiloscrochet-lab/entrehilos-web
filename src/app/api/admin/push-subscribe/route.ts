import { NextResponse } from "next/server";

function deprecatedResponse() {
  return NextResponse.json(
    {
      error: "Web Push deprecado. Usa las alertas nativas de Supabase mediante /api/admin/device-token desde la app Android.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return deprecatedResponse();
}

export async function DELETE() {
  return deprecatedResponse();
}
