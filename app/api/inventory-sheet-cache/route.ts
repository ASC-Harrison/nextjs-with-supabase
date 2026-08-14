import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("building_inventory_sheet_view")
    .select("item_id,name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit,notes,is_active,order_status,backordered")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(data ?? [], {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
