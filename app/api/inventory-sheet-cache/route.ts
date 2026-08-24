import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [itemsResult, totalsResult] = await Promise.all([
    supabaseAdmin
      .from("items")
      .select("id,name,reference_number,vendor,category,par_level,low_level,unit,notes,is_active,order_status,backordered,supply_source,price,expiration_date,alert_note"),
    supabaseAdmin
      .from("building_totals")
      .select("item_id,building_on_hand"),
  ]);

  if (itemsResult.error || totalsResult.error) {
    const message = itemsResult.error?.message ?? totalsResult.error?.message ?? "Inventory load failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const totalsByItem = new Map(
    (totalsResult.data ?? []).map((row) => [row.item_id, Number(row.building_on_hand ?? 0)]),
  );

  const data = (itemsResult.data ?? [])
    .map((item) => ({
      item_id: item.id,
      name: item.name,
      reference_number: item.reference_number,
      vendor: item.vendor,
      category: item.category,
      total_on_hand: totalsByItem.get(item.id) ?? 0,
      par_level: item.par_level,
      low_level: item.low_level,
      unit: item.unit,
      notes: item.notes,
      is_active: item.is_active,
      order_status: item.order_status,
      backordered: item.backordered,
      supply_source: item.supply_source,
      price: item.price,
      expiration_date: item.expiration_date,
      alert_note: item.alert_note,
    }))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
