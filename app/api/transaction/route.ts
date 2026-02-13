import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function OPTIONS() {
  // makes sure no browser preflight ever returns 405
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/transaction" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const location = String(body.location ?? "").trim();
    const mode = String(body.mode ?? "USE").toUpperCase(); // USE | RESTOCK
    const itemOrBarcode = String(body.itemOrBarcode ?? "").trim();
    const qty = Math.max(1, Number(body.qty ?? 1));

    if (!location || !itemOrBarcode) {
      return NextResponse.json({ ok: false, error: "Missing location or itemOrBarcode" }, { status: 400 });
    }

    // find location (must match your locations.name)
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .select("id, name")
      .ilike("name", location)
      .limit(1)
      .maybeSingle();

    if (locErr) return NextResponse.json({ ok: false, error: locErr.message }, { status: 500 });
    if (!loc?.id) return NextResponse.json({ ok: false, error: `Location not found: ${location}` }, { status: 404 });

    // find item by barcode exact OR name contains
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .or(`barcode.eq.${itemOrBarcode},name.ilike.%${itemOrBarcode}%`)
      .limit(1)
      .maybeSingle();

    if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
    if (!item?.id) return NextResponse.json({ ok: false, error: `Item not found: ${itemOrBarcode}` }, { status: 404 });

    // get current
    const { data: existing, error: exErr } = await supabase
      .from("inventory")
      .select("on_hand")
      .eq("item_id", item.id)
      .eq("location_id", loc.id)
      .maybeSingle();

    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });

    const current = Number(existing?.on_hand ?? 0);
    const next = mode === "USE" ? Math.max(0, current - qty) : current + qty;

    const { error: upErr } = await supabase
      .from("inventory")
      .upsert(
        { item_id: item.id, location_id: loc.id, on_hand: next, status: "OK" },
        { onConflict: "item_id,location_id" }
      );

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, item, location: loc, old_on_hand: current, new_on_hand: next });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
