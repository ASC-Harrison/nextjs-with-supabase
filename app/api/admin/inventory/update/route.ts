import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { storage_area_id, item_id, on_hand, par_level } = body ?? {};

  if (!storage_area_id || !item_id) {
    return NextResponse.json({ ok: false, error: "Missing storage_area_id or item_id" });
  }

  const supabase = supabaseServer();

  const { error } = await supabase
    .from("storage_inventory")
    .update({ on_hand: Number(on_hand), par_level: Number(par_level) })
    .eq("storage_area_id", storage_area_id)
    .eq("item_id", item_id);

  if (error) return NextResponse.json({ ok: false, error: error.message });

  return NextResponse.json({ ok: true });
}
