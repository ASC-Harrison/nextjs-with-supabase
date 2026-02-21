export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { area_id, mode, item_id, qty, mainOverride, actor, device } = await req.json();

  if (!item_id || !mode) {
    return NextResponse.json({ ok: false, error: "Missing item_id/mode" }, { status: 400, headers });
  }

  const n = Math.max(1, Math.abs(Number(qty ?? 1)));
  const finalArea = mainOverride === true ? process.env.MAIN_SUPPLY_AREA_ID : area_id;

  if (!finalArea) return NextResponse.json({ ok: false, error: "No location selected" }, { status: 400, headers });

  const { data: row, error: getErr } = await supabaseAdmin
    .from("storage_inventory")
    .select("on_hand,par_level")
    .eq("item_id", item_id)
    .eq("area_id", finalArea)
    .maybeSingle();

  if (getErr) return NextResponse.json({ ok: false, error: getErr.message }, { status: 500, headers });

  const onHand = row?.on_hand ?? 0;
  const delta = mode === "USE" ? -n : n;
  const newOnHand = onHand + delta;

  const { error: upErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      { item_id, area_id: finalArea, on_hand: newOnHand, par_level: row?.par_level ?? 0 },
      { onConflict: "item_id,area_id" }
    );

  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500, headers });

  // Audit log
  await supabaseAdmin.from("inventory_events").insert({
    event_type: "transaction",
    area_id: finalArea,
    item_id,
    mode,
    qty: n,
    actor: actor ?? null,
    device: device ?? null,
    meta: { mainOverride: Boolean(mainOverride) },
  });

  return NextResponse.json({ ok: true, on_hand: newOnHand }, { headers });
}
