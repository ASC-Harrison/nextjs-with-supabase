export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const body = await req.json().catch(() => ({}));

  const area_id = String(body.area_id ?? "").trim();
  const item_id = String(body.item_id ?? "").trim();
  const mode = String(body.mode ?? "").trim(); // USE | RESTOCK
  const qty = Math.max(1, Math.abs(Number(body.qty ?? 1)));
  const mainOverride = Boolean(body.mainOverride);

  const actor = String(body.actor ?? "").trim() || null;
  const device = String(body.device ?? "").trim() || null;

  if (!item_id || (mode !== "USE" && mode !== "RESTOCK")) {
    return NextResponse.json({ ok: false, error: "Missing/invalid item_id or mode" }, { status: 400, headers });
  }

  const finalArea = mainOverride ? (process.env.MAIN_SUPPLY_AREA_ID ?? "") : area_id;
  if (!finalArea) {
    return NextResponse.json({ ok: false, error: "No location selected" }, { status: 400, headers });
  }

  // Get current row
  const { data: row, error: getErr } = await supabaseAdmin
    .from("storage_inventory")
    .select("on_hand,par_level,low_notified")
    .eq("item_id", item_id)
    .eq("area_id", finalArea)
    .maybeSingle();

  if (getErr) return NextResponse.json({ ok: false, error: getErr.message }, { status: 500, headers });

  const onHand = Number(row?.on_hand ?? 0);
  const par = Number(row?.par_level ?? 0);
  const delta = mode === "USE" ? -qty : qty;
  const newOnHand = onHand + delta;

  // If we restock to/par above par, clear low_notified so future alerts can fire again
  const newLowNotified =
    mode === "RESTOCK" && par > 0 && newOnHand >= par ? false : Boolean(row?.low_notified ?? false);

  const { error: upErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      { item_id, area_id: finalArea, on_hand: newOnHand, par_level: par, low_notified: newLowNotified },
      { onConflict: "item_id,area_id" }
    );

  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500, headers });

  // Audit log
  await supabaseAdmin.from("inventory_events").insert({
    event_type: "transaction",
    area_id: finalArea,
    item_id,
    mode,
    qty,
    actor,
    device,
    meta: { mainOverride },
  });

  return NextResponse.json({ ok: true, on_hand: newOnHand }, { headers });
}
