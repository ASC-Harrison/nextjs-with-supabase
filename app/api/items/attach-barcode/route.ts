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
    const item_id = String(body.item_id || "");
    const barcode = String(body.barcode || "").trim();
    const note = String(body.note || "").trim();

    if (!item_id || !barcode) {
      return NextResponse.json(
        { ok: false, error: "Missing item_id or barcode" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("item_barcodes").insert({
      item_id,
      barcode,
      note: note || null,
    });

    if (error) {
      // Common case: barcode already exists
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
