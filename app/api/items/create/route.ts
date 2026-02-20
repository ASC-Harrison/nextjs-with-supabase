import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { name, barcode, area_id, par_level } = await req.json();

  if (!name || !barcode || !area_id) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: name, barcode, area_id" },
      { status: 400 }
    );
  }

  // create item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("items")
    .insert({ name, barcode })
    .select("id,name,barcode")
    .single();

  if (itemErr) {
    return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
  }

  // ensure inventory row exists at that location
  const { error: invErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      {
        item_id: item.id,
        area_id,
        on_hand: 0,
        par_level: Number(par_level ?? 0),
      },
      { onConflict: "item_id,area_id" }
    );

  if (invErr) {
    return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item });
}
