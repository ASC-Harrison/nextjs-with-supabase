import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  id: string;
  status?: "ORDERED" | "BACKORDER" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  qty_ordered?: number;
  qty_received?: number;
  notes?: string | null;
};

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const id = (body.id || "").trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const patch: Record<string, any> = {};

    if (body.status !== undefined) {
      const allowed = ["ORDERED", "BACKORDER", "PARTIAL", "RECEIVED", "CANCELLED"];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;
    }

    if (body.qty_ordered !== undefined) {
      if (!Number.isFinite(body.qty_ordered) || body.qty_ordered < 0) {
        return NextResponse.json({ ok: false, error: "Invalid qty_ordered" }, { status: 400 });
      }
      patch.qty_ordered = body.qty_ordered;
    }

    if (body.qty_received !== undefined) {
      if (!Number.isFinite(body.qty_received) || body.qty_received < 0) {
        return NextResponse.json({ ok: false, error: "Invalid qty_received" }, { status: 400 });
      }
      patch.qty_received = body.qty_received;
    }

    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() ? body.notes.trim() : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("purchase_order_items")
      .update(patch)
      .eq("id", id)
      .select(
        "id,item_id,qty_ordered,qty_received,status,notes,purchase_order_id,purchase_orders(id,po_number,vendor,status,expected_date,order_date,notes)"
      )
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
