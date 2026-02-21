// app/api/items/create/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name ?? "").trim();
    const barcode = String(body?.barcode ?? "").trim();
    const storage_area_id = String(body?.area_id ?? body?.storage_area_id ?? "").trim();
    const par_level = Number(body?.par_level ?? 0);

    if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    if (!barcode) return NextResponse.json({ ok: false, error: "Missing barcode" }, { status: 400 });
    if (!storage_area_id) return NextResponse.json({ ok: false, error: "Missing storage_area_id" }, { status: 400 });

    // Create item
    const { data: newItem, error: itemErr } = await supabaseAdmin
      .from("items")
      .insert({
        name,
        barcode,
        par_level: Number.isFinite(par_level) ? par_level : 0,
        active: true,
      })
      .select("id,name,barcode")
      .single();

    if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });

    // Create barcode mapping too (if you use item_barcodes)
    await supabaseAdmin.from("item_barcodes").insert({
      item_id: newItem.id,
      barcode,
    });

    // Ensure storage_inventory row exists for this area/item
    const { data: invRow, error: invErr } = await supabaseAdmin
      .from("storage_inventory")
      .select("storage_area_id,item_id,on_hand,par_level")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", newItem.id)
      .maybeSingle();

    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });

    if (!invRow) {
      const { error: insErr } = await supabaseAdmin.from("storage_inventory").insert({
        storage_area_id,
        item_id: newItem.id,
        on_hand: 0,
        par_level: Number.isFinite(par_level) ? par_level : 0,
        low: false,
        low_notified: false,
      });

      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    // Optional audit log (won't break if table doesn't match)
    try {
      await supabaseAdmin.from("inventory_events").insert({
        event_type: "CREATE_ITEM",
        item_id: newItem.id,
        storage_area_id,
        qty: 0,
        note: `Created item ${name}`,
      });
    } catch {}

    return NextResponse.json(
      { ok: true, item: { id: newItem.id, name: newItem.name, barcode: newItem.barcode ?? barcode } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
