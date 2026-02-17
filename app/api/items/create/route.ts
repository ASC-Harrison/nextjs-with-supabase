import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name || "").trim();
    const par_level = body.par_level == null ? null : Number(body.par_level);
    const low_level = body.low_level == null ? null : Number(body.low_level);
    const vendor = String(body.vendor || "").trim() || null;
    const category = String(body.category || "").trim() || null;
    const reference_number = String(body.reference_number || "").trim() || null;

    const scanned_barcode = String(body.barcode || "").trim(); // optional

    if (!name) {
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    }

    // Insert item
    const { data: item, error: insErr } = await supabase
      .from("items")
      .insert({
        name,
        par_level,
        low_level,
        vendor,
        category,
        reference_number,
        active: true,
      })
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
    }

    // If you scanned a manufacturer barcode, attach it as an alias
    if (scanned_barcode) {
      const { error: bcErr } = await supabase.from("item_barcodes").insert({
        item_id: item.id,
        barcode: scanned_barcode,
        note: "Added during create",
      });

      if (bcErr) {
        // Item created but barcode attach failed (often because barcode already exists)
        return NextResponse.json(
          { ok: true, item_id: item.id, warning: bcErr.message },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ ok: true, item_id: item.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
