import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const surgeon = body?.surgeon ? String(body.surgeon).trim() : null;
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (!name) {
      return NextResponse.json({ ok: false, error: "Procedure name is required." });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("procedures")
      .insert({
        name,
        surgeon: surgeon || null,
        notes: notes || null,
      })
      .select("id,name,surgeon,notes,created_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, procedure: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
