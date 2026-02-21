export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { name, barcode, area_id, par_level, actor, device } = await req.json();

  if (!name || !barcode || !area_id) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: name, barcode, area_id" },
      { status: 400, headers }
    );
  }

  // Create item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("items")
    .insert({ name, barcode })
    .select("id,name,barcode")
    .single();

  if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500, headers });

  // Ensure inventory row exists
  const { error: invErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(
      { item_id: item.id, area_id, on_hand: 0, par_level: Number(par_level ?? 0) },
      { onConflict: "item_id,area_id" }
    );

  if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500, headers });

  // Audit log
  await supabaseAdmin.from("inventory_events").insert({
    event_type: "add_item",
    area_id,
    item_id: item.id,
    barcode,
    item_name: name,
    actor: actor ?? null,
    device: device ?? null,
    meta: { par_level: Number(par_level ?? 0) },
  });

  return NextResponse.json({ ok: true, item }, { headers });
}
