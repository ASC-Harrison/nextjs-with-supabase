import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const storage_area_id = String(body.storage_area_id || "");
    const item_id = String(body.item_id || "");
    const raw = body.par_level;

    const par_level =
      raw === "" || raw === null || raw === undefined ? null : Number(raw);

    if (!storage_area_id || !item_id) {
      return NextResponse.json({ ok: false, error: "Missing ids" }, { status: 400 });
    }
    if (par_level !== null && (!Number.isFinite(par_level) || par_level < 0)) {
      return NextResponse.json({ ok: false, error: "Invalid par_level" }, { status: 400 });
    }

    const sb = serverSupabase();

    const { data, error } = await sb
      .from("storage_inventory")
      .update({ par_level })
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .select("par_level")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, par_level: data?.par_level ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
