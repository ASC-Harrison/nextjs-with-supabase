import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationName = String(searchParams.get("location") ?? "").trim();

    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("item_id, location_id, on_hand, status");

    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });

    const invRows = inv ?? [];
    if (invRows.length === 0) return NextResponse.json({ ok: true, rows: [] });

    const itemIds = Array.from(new Set(invRows.map((r) => r.item_id)));
    const locIds = Array.from(new Set(invRows.map((r) => r.location_id)));

    const [{ data: items, error: itemsErr }, { data: locs, error: locsErr }] = await Promise.all([
      supabase.from("items").select("id, name, barcode").in("id", itemIds),
      supabase.from("locations").select("id, name").in("id", locIds),
    ]);

    if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
    if (locsErr) return NextResponse.json({ ok: false, error: locsErr.message }, { status: 500 });

    const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
    const locMap = new Map((locs ?? []).map((l) => [l.id, l]));

    let rows = invRows.map((r) => ({
      item_id: r.item_id,
      location_id: r.location_id,
      on_hand: r.on_hand,
      status: r.status,
      item_name: itemMap.get(r.item_id)?.name ?? "Unknown Item",
      barcode: itemMap.get(r.item_id)?.barcode ?? null,
      location_name: locMap.get(r.location_id)?.name ?? "Unknown Location",
    }));

    if (locationName) {
      rows = rows.filter((r) => r.location_name.toLowerCase() === locationName.toLowerCase());
    }

    rows.sort((a, b) => a.item_name.localeCompare(b.item_name));
    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}

// Optional: this prevents 405 if something POSTs by accident
export async function POST() {
  return NextResponse.json({ ok: true, note: "Use GET for /api/inventory-list" });
}
