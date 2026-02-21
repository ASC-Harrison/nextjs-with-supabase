export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { area_id, mode, item_id, qty, mainOverride } = await req.json();

  if (!item_id || !mode) {
    return NextResponse.json({ ok: false, error: "Missing item_id/mode" }, { status: 400 });
  }

  const n = Math.max(1, Math.abs(Number(qty ?? 1)));

  // If you want MAIN override to go to a specific storage_areas row, set MAIN_SUPPLY_AREA_ID in env
  const finalArea = mainOverride === true ? process.env.MAIN_SUPPLY_AREA_ID : area_id;

  if (!finalArea) {
    return NextResponse.json({ ok: false, error: "No location selected" }, { status: 400 });
  }

  const { data: row, error: getErr } = await supabaseAdmin
    .from("storage_inventory")
    .select("on_hand,par_level")
    .eq("item_id", item_id)
    .eq("area_id", finalArea)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
  }

  const onHand = row?.on_hand ?? 0;
  const delta = mode === "USE" ? -n : n;
  const newOnHand = onHand + delta;

  const { error: upErr } = await supabaseAdmin
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

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, on_hand: newOnHand });
}
