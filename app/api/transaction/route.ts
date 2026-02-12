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

    if (!locationName)
      return NextResponse.json({ ok: false, error: "Missing location" }, { status: 400 });

    if (!itemOrBarcode)
      return NextResponse.json({ ok: false, error: "Missing itemOrBarcode" }, { status: 400 });

    const { data: loc } = await supabase
      .from("locations")
      .select("id, name")
      .ilike("name", locationName)
      .limit(1)
      .maybeSingle();

    if (!loc?.id)
      return NextResponse.json({ ok: false, error: "Location not found" }, { status: 404 });

    const { data: item } = await supabase
      .from("items")
      .select("id, name, barcode")
      .or(`barcode.eq.${itemOrBarcode},name.ilike.%${itemOrBarcode}%`)
      .limit(1)
      .maybeSingle();

    if (!item?.id)
      return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });

    const { data: invRow } = await supabase
      .from("inventory")
      .select("on_hand")
      .eq("item_id", item.id)
      .eq("location_id", loc.id)
      .maybeSingle();

    const current = Number(invRow?.on_hand ?? 0);
    const delta = mode === "USE" ? -qty : qty;
    const next = Math.max(0, current + delta);

    const { data: updated } = await supabase
      .from("inventory")
      .upsert(
        {
          item_id: item.id,
          location_id: loc.id,
          on_hand: next,
          status: "OK",
        },
        { onConflict: "item_id,location_id" }
      )
      .select("on_hand")
      .single();

    return NextResponse.json({
      ok: true,
      mode,
      qty,
      item,
      location: loc,
      old_on_hand: current,
      new_on_hand: updated?.on_hand ?? next,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
