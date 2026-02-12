import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/items  -> totals list (one row per product)
export async function GET() {
  const { data, error } = await supabase
    .from("building_inventory_named")
    .select("item_id, item_name, barcode, total_on_hand")
    .order("item_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}

