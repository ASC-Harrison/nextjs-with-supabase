// app/api/transaction/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  storage_area_id: string;
  mode: "USE" | "RESTOCK";
  item_id: string;
  qty: number;
  mainOverride?: boolean;
  staff?: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

export async function POST(req: Request) {
  try {
    const supabase = getServiceClient();
    const body = (await req.json()) as Body;

    const areaId = (body.storage_area_id || "").trim();
    const itemId = (body.item_id || "").trim();
    const qty = Number(body.qty || 0);
    const mode = body.mode;

    if (!areaId) return NextResponse.json({ ok: false, error: "Missing storage_area_id" });
    if (!itemId) return NextResponse.json({ ok: false, error: "Missing item_id" });
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "qty must be > 0" });
    }

    // Decide real action
    // - USE: subtract from selected area (or main if override)
    // - RESTOCK:
    //    - if you’re in MAIN area => RECEIVE (shipment)
    //    - else MOVE from MAIN -> target area
    let txMode: "USE" | "MOVE" | "RECEIVE" = "USE";
    let targetArea = areaId;

    if (mode === "USE") {
      targetArea = body.mainOverride ? MAIN_SUPPLY_ID : areaId;
      txMode = "USE";
    } else {
      // RESTOCK button
      if (areaId === MAIN_SUPPLY_ID) {
        txMode = "RECEIVE"; // shipment into main
        targetArea = MAIN_SUPPLY_ID;
      } else {
        txMode = "MOVE"; // move from main -> cabinet
        targetArea = areaId;
      }
    }

    const { data, error } = await supabase.rpc("apply_inventory_tx", {
      p_mode: txMode,
      p_target_area: targetArea,
      p_item: itemId,
      p_qty: qty,
      p_main_area: MAIN_SUPPLY_ID,
    });

    if (error) throw error;

    // rpc returns an array of rows
    const row = Array.isArray(data) ? data[0] : data;
    const on_hand =
      txMode === "RECEIVE"
        ? row?.main_on_hand
        : row?.target_on_hand;

    return NextResponse.json({
      ok: true,
      mode: txMode,
      on_hand: on_hand ?? null,
      main_on_hand: row?.main_on_hand ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message ?? "Transaction failed",
    });
  }
}
