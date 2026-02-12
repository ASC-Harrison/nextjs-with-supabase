import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toInt(value: unknown, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/transaction" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mode = String(body.mode ?? "USE").toUpperCase();
    const qty = Math.max(1, toInt(body.qty, 1));
    const itemOrBarcode = String(body.itemOrBarcode ?? "").trim();
    const locationName = String(body.location ?? "").trim();

    if (!locationName) return NextResponse.json({ ok: false, error: "Missing location" }, { status: 400 });
    if (!itemOrBarcode) return NextResponse.json({ ok: false, error: "Missing itemOrBarcode" }, { status: 400 });
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Mode must be USE or RESTOCK" }, { status: 400 });
    }

    // location lookup
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .select("id, name")
      .ilike("name", locationName)
      .limit(1)
      .maybeSingle();

    if (locErr) return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 });
    if (!loc?.id) return NextResponse.json({ ok: false, error: `Location not found: ${locationName}` }, { status: 404 });

    // item lookup
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .or(`barcode.eq.${itemOrBarcode},name.ilike.%${itemOrBarcode}%`)
      .limit(1)
      .maybeSingle();

    if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
    if (!item?.id) return NextResponse.json({ ok: false, error: `Item not found: ${itemOrBarcode}` }, { status: 404 });

    const item_id = item.id;
    const location_id = loc.id;

    // read current inventory
    const { data: invRow, error: invErr } = await supabase
      .from("inventory")
      .select("on_hand")
      .eq("item_id", item_id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });

    const current = Number(invRow?.on_hand ?? 0);
    const delta = mode === "USE" ? -qty : qty;
    const next = Math.max(0, current + delta);

    const { data: updated, error: updErr } = a
