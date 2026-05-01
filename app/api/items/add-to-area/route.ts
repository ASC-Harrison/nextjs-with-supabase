import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const { storage_area_id, item_id, on_hand, par_level, low_level } = await req.json();

    if (!storage_area_id || !item_id) {
      return NextResponse.json({ ok: false, error: "storage_area_id and item_id are required" });
    }

    const supabase = getServiceClient();

    // Use raw SQL to bypass view routing issues
    const onHand = on_hand ?? 0;
    const parLevel = par_level ?? 0;
    const lowLevel = low_level ?? 0;

    const { error } = await supabase.rpc("upsert_storage_inventory", {
      p_storage_area_id: storage_area_id,
      p_item_id: item_id,
      p_on_hand: onHand,
      p_par_level: parLevel,
      p_low_level: lowLevel,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
