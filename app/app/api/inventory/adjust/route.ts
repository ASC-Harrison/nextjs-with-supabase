import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { item_id, type, qty } = await req.json();

    const cleanItemId = String(item_id ?? "");
    const cleanType = type === "IN" || type === "OUT" ? type : null;
    const cleanQty = Number(qty);

    if (!cleanItemId) {
      return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }
    if (!cleanType) {
      return NextResponse.json({ error: "type must be IN or OUT" }, { status: 400 });
    }

    // ✅ NO DEFAULTS. No "|| 10". If qty isn't valid, it fails.
    if (!Number.isInteger(cleanQty) || cleanQty <= 0) {
      return NextResponse.json({ error: "qty must be a positive integer" }, { status: 400 });
    }

    // ✅ ONLY write to transactions. Trigger updates inventory.
    const { error } = await supabaseAdmin.from("transactions").insert({
      item_id: cleanItemId,
      qty: cleanQty,
      type: cleanType,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

