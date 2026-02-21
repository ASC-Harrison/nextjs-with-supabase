import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function requireAdmin(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SECRET in env.");

  const got = req.headers.get("x-admin-secret") || "";
  if (got !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// POST body:
// { storage_area_id, item_id, on_hand?, par_level? }
export async function POST(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getAdminClient();

    const body = await req.json();
    const storage_area_id = String(body.storage_area_id || "").trim();
    const item_id = String(body.item_id || "").trim();

    if (!storage_area_id || !item_id) {
      return NextResponse.json({ ok: false, error: "Missing storage_area_id or item_id" }, { status: 400 });
    }

    const patch: any = {};
    if (body.on_hand !== undefined) {
      const v = Number(body.on_hand);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ ok: false, error: "Invalid on_hand" }, { status: 400 });
      patch.on_hand = Math.floor(v);
    }
    if (body.par_level !== undefined) {
      const v = Number(body.par_level);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ ok: false, error: "Invalid par_level" }, { status: 400 });
      patch.par_level = Math.floor(v);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    // Update exactly one row by composite key
    const { data, error } = await supabase
      .from("storage_inventory")
      .update(patch)
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .select("storage_area_id,item_id,on_hand,par_level,low,low_notified,updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
