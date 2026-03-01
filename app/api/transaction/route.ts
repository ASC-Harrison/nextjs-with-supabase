import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  storage_area_id: string;
  mode: "USE" | "RESTOCK";
  item_id: string;
  qty: number;
  mainOverride?: boolean;
  staff?: string; // OPTIONAL (we'll accept it if you send it)
  device_id?: string; // OPTIONAL
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

    const storage_area_id = (body.storage_area_id || "").trim();
    const mode = body.mode;
    const item_id = (body.item_id || "").trim();
    const qty = Number(body.qty || 0);
    const mainOverride = !!body.mainOverride;

    // We will log staff if provided, otherwise fall back to "Unknown"
    const staff = (body.staff || "Unknown").trim() || "Unknown";
    const device_id = (body.device_id || "").trim() || null;

    if (!storage_area_id) {
      return NextResponse.json({ ok: false, error: "Missing storage_area_id" });
    }
    if (!item_id) {
      return NextResponse.json({ ok: false, error: "Missing item_id" });
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Invalid mode" });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "qty must be > 0" });
    }

    const supabase = getServiceClient();

    // Call your atomic function
    const { data, error } = await supabase.rpc("apply_tx", {
      p_storage_area_id: storage_area_id,
      p_item_id: item_id,
      p_mode: mode,
      p_qty: qty,
      p_staff: staff,
      p_device_id: device_id,
      p_main_override: mainOverride,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    // apply_tx returns table(new_on_hand int)
    const newOnHand =
      Array.isArray(data) && data.length ? data[0]?.new_on_hand : null;

    return NextResponse.json({ ok: true, on_hand: newOnHand });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
