import { NextResponse } from "@vercel/node";
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

    const procedure_id = String(body?.procedure_id ?? "").trim();
    const item_id = String(body?.item_id ?? "").trim();
    const source_area_id = String(body?.source_area_id ?? "").trim();
    const default_qty = Number(body?.default_qty ?? 0);
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (!procedure_id) {
      return NextResponse.json({ ok: false, error: "procedure_id is required." });
    }
    if (!item_id) {
      return NextResponse.json({ ok: false, error: "item_id is required." });
    }
    if (!source_area_id) {
      return NextResponse.json({ ok: false, error: "source_area_id is required." });
    }
    if (!Number.isFinite(default_qty) || default_qty <= 0) {
      return NextResponse.json({ ok: false, error: "default_qty must be 1 or more." });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("preference_card_items")
      .insert({
        procedure_id,
        item_id,
        source_area_id,
        default_qty: Math.trunc(default_qty),
        notes: notes || null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
