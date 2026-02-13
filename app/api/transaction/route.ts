import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { location, mode, itemOrBarcode, qty } = body;

    if (!location || !itemOrBarcode) {
      return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    }

    // find location
    const { data: loc } = await supabase
      .from("locations")
      .select("id")
      .ilike("name", location)
      .single();

    if (!loc) {
      return NextResponse.json({ ok: false, error: "Location not found" }, { status: 404 });
    }

    // find item
    const { data: item } = await supabase
      .from("items")
      .select("id, name")
      .or(`barcode.eq.${itemOrBarcode},name.ilike.%${itemOrBarcode}%`)
      .limit(1)
      .single();

    if (!item) {
      return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });
    }

    // get current inventory row
    const { data: existing } = await supabase
      .from("inventory")
      .select("on_hand")
      .eq("item_id", item.id)
      .eq("location_id", loc.id)
      .single();

    const current = existing?.on_hand || 0;

    const newValue =
      mode === "USE"
        ? Math.max(0, current - Number(qty))
        : current + Number(qty);

    await supabase
      .from("inventory")
      .upsert(
        {
          item_id: item.id,
          location_id: loc.id,
          on_hand: newValue,
          status: "OK",
        },
        { onConflict: "item_id,location_id" }
      );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
