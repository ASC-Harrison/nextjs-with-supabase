import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("storage_inventory")
    .select("storage_area_id, item_id, on_hand, par_level, low, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ ok: false, error: error.message });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
