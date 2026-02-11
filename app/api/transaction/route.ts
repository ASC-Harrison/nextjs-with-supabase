import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      item_id,
      location_id,
      qty,
      txn_type,   // "PULL" or "RESTOCK"
      source,     // "CABINET" or "MAIN_SUPPLY"
      note = null,
    } = body;

    // Basic validation
    if (!item_id || !location_id || !qty || !txn_type || !source) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.rpc("process_inventory_transaction", {
      p_item_id: item_id,
      p_location_id: location_id,
      p_qty: Number(qty),
      p_txn_type: txn_type,
      p_source: source,
      p_note: note,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
