import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const item_id = String(body.item_id ?? "");
    const type = body.type;
    const qty = Number(body.qty);

    if (!item_id) {
      return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }

    if (type !== "IN" && type !== "OUT") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // 🚫 NO DEFAULTS — THIS IS WHAT FIXES THE "10" BUG
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
    }

    const { error } = await supabase.from("transactions").insert({
      item_id,
      type,
      qty
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
