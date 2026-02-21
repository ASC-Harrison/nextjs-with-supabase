export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? "").trim();
  const barcode = String(body.barcode ?? "").trim();
  const area_id = String(body.area_id ?? "").trim();
  const par_level = Number(body.par_level ?? 0);

  const actor = String(body.actor ?? "").trim() || null;
  const device = String(body.device ?? "").trim() || null;

  if (!name || !barcode || !area_id) {
    return NextResponse.json(
      { ok: false, error: "Missing required: name, barcode, area_id" },
      { status: 400, headers }
    );
  }

  // Create item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("items")
    .insert({ name, barcode })
    .select("id,name,barcode")
    .single();

  if (itemErr) {
    return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500, headers });
  }

  // Ensure inventory row exists
  const { error: invErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      { item_id: item.id, area_id, on_hand: 0, par_level: par_level, low_notified: false },
      { onConflict: "item_id,area_id" }
    );

  if (invErr) {
    return NextResponse.json({ ok: false, error: invErr.message }, { status: 500, headers });
  }

  // Audit log
  await supabaseAdmin.from("inventory_events").insert({
    event_type: "add_item",
    area_id,
    item_id: item.id,
    barcode,
    item_name: name,
    actor,
    device,
    meta: { par_level },
  });

  return NextResponse.json({ ok: true, item }, { headers });
}
