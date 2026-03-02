import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

type Body = {
  case_line_id: string;
  qty: number; // how many used now
  storage_area_id: string; // cabinet area
  mainOverride?: boolean;  // if pulled from MAIN supply
  staff?: string;
  device_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const case_line_id = (body.case_line_id || "").trim();
    const qty = Number(body.qty ?? 0);
    const storage_area_id = (body.storage_area_id || "").trim();
    const mainOverride = !!body.mainOverride;

    const staff = (body.staff || "Unknown").trim() || "Unknown";
    const device_id = (body.device_id || "").trim() || null;

    if (!case_line_id) return NextResponse.json({ ok: false, error: "Missing case_line_id" });
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "qty must be > 0" });
    }
    if (!storage_area_id && !mainOverride) {
      return NextResponse.json({ ok: false, error: "Missing storage_area_id (or use mainOverride)" });
    }

    const supabase = getServiceClient();

    // Load line
    const { data: line, error: lErr } = await supabase
      .from("case_lines")
      .select("id,case_id,item_id,planned_qty,reserved_qty,used_qty")
      .eq("id", case_line_id)
      .single();

    if (lErr) return NextResponse.json({ ok: false, error: lErr.message });

    const planned = Number(line.planned_qty ?? 0);
    const usedNow = Number(line.used_qty ?? 0);
    const nextUsed = usedNow + qty;

    // Optional sanity: don’t exceed planned by default (you can remove this later)
    const cappedUsed = Math.min(nextUsed, planned);

    // Subtract inventory for qtyUsedThisCall (may be capped)
    const qtyToConsume = cappedUsed - usedNow;
    if (qtyToConsume <= 0) {
      return NextResponse.json({ ok: true, used_qty: usedNow, on_hand: null });
    }

    // Call your atomic inventory function
    const { data: txData, error: txErr } = await supabase.rpc("apply_tx", {
      p_storage_area_id: storage_area_id,
      p_item_id: line.item_id,
      p_mode: "USE",
      p_qty: qtyToConsume,
      p_staff: staff,
      p_device_id: device_id,
      p_main_override: mainOverride,
    });

    if (txErr) return NextResponse.json({ ok: false, error: txErr.message });

    const newOnHand =
      Array.isArray(txData) && txData.length ? txData[0]?.new_on_hand : null;

    // Update used_qty
    const { error: uErr } = await supabase
      .from("case_lines")
      .update({ used_qty: cappedUsed })
      .eq("id", case_line_id);

    if (uErr) return NextResponse.json({ ok: false, error: uErr.message });

    await supabase.from("case_events").insert({
      case_id: line.case_id,
      staff,
      device_id,
      action: "USED_ADD",
      item_id: line.item_id,
      qty: qtyToConsume,
      details: `Used+=${qtyToConsume} TotalUsed=${cappedUsed}/${planned} Override=${mainOverride ? "MAIN" : "AREA"}`,
    });

    return NextResponse.json({ ok: true, used_qty: cappedUsed, on_hand: newOnHand });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
