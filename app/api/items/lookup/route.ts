// app/api/items/lookup/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { barcode } = await req.json();
    const bc = String(barcode ?? "").trim();

    if (!bc) return NextResponse.json({ ok: false, error: "Missing barcode" }, { status: 400 });

    // 1) Try item_barcodes -> item_id
    const { data: bcRow, error: bcErr } = await supabaseAdmin
      .from("item_barcodes")
      .select("item_id,barcode")
      .eq("barcode", bc)
      .maybeSingle();

    if (bcErr) {
      // If item_barcodes table exists but errors, fail clearly
      return NextResponse.json({ ok: false, error: bcErr.message }, { status: 500 });
    }

    if (bcRow?.item_id) {
      const { data: itemRow, error: itemErr } = await supabaseAdmin
        .from("items")
        .select("id,name")
        .eq("id", bcRow.item_id)
        .maybeSingle();

      if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
      if (!itemRow) return NextResponse.json({ ok: true, item: null }, { status: 200 });

      return NextResponse.json(
        { ok: true, item: { id: itemRow.id, name: itemRow.name, barcode: bc } },
        { status: 200 }
      );
    }

    // 2) Fallback: items.barcode directly
    const { data: item2, error: item2Err } = await supabaseAdmin
      .from("items")
      .select("id,name,barcode")
      .eq("barcode", bc)
      .maybeSingle();

    if (item2Err) return NextResponse.json({ ok: false, error: item2Err.message }, { status: 500 });
    if (!item2) return NextResponse.json({ ok: true, item: null }, { status: 200 });

    return NextResponse.json(
      { ok: true, item: { id: item2.id, name: item2.name, barcode: item2.barcode ?? bc } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
