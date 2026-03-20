import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = (searchParams.get("item_id") || "").trim();

    if (!itemId) {
      return NextResponse.json({ ok: false, error: "Missing item_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("purchase_order_items")
      .select(
        "id,item_id,qty_ordered,qty_received,status,notes,purchase_order_id,purchase_orders(id,po_number,vendor,status,expected_date,order_date,notes)"
      )
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
