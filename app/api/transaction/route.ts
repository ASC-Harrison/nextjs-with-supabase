import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json();
  const { area_id, mode, item_id, qty, mainOverride } = body;

  if (!item_id || !qty || !mode) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const finalArea =
    mainOverride === true ? process.env.MAIN_SUPPLY_AREA_ID : area_id;

  if (!finalArea) {
    return NextResponse.json(
      { ok: false, error: "No area selected (or MAIN_SUPPLY_AREA_ID not set)" },
      { status: 400 }
    );
  }

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("storage_inventory")
    .select("on_hand,par_level")
    .eq("item_id", item_id)
    .eq("area_id", finalArea)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ ok: false, error: rowErr.message }, { status: 500 });
  }

  const onHand = row?.on_hand ?? 0;
  const delta = mode === "USE" ? -Math.abs(qty) : Math.abs(qty);
  const newOnHand = onHand + delta;

  const { error: upsertErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      {
        item_id,
        area_id: finalArea,
        on_hand: newOnHand,
        par_level: row?.par_level ?? 0,
      },
      { onConflict: "item_id,area_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, on_hand: newOnHand });
}
