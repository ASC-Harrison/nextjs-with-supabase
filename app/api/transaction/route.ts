// app/api/transaction/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Mode = "USE" | "RESTOCK";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mode: Mode = body?.mode;
    const item_id = String(body?.item_id ?? "").trim();
    const qty = Math.max(1, Number(body?.qty ?? 1));
    const mainOverride = Boolean(body?.mainOverride);

    // UI sends area_id; DB expects storage_area_id
    const chosenArea = String(body?.area_id ?? body?.storage_area_id ?? "").trim();

    const MAIN_SUPPLY_AREA_ID = process.env.MAIN_SUPPLY_AREA_ID || "";
    const storage_area_id = mainOverride
      ? (MAIN_SUPPLY_AREA_ID || chosenArea)
      : chosenArea;

    if (!item_id) return NextResponse.json({ ok: false, error: "Missing item_id" }, { status: 400 });
    if (!storage_area_id) {
      return NextResponse.json(
        { ok: false, error: "Missing storage_area_id (select a location, or set MAIN_SUPPLY_AREA_ID for MAIN override)" },
        { status: 400 }
      );
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    // Get existing inventory row
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("storage_inventory")
      .select("on_hand,par_level,low,low_notified")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .maybeSingle();

    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });

    // If missing row, create it (so transactions don't fail)
    if (!inv) {
      const { error: insErr } = await supabaseAdmin.from("storage_inventory").insert({
        storage_area_id,
        item_id,
        on_hand: 0,
        par_level: 0,
        low: false,
        low_notified: false,
      });
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    // Re-fetch after ensuring exists
    const { data: inv2, error: inv2Err } = await supabaseAdmin
      .from("storage_inventory")
      .select("on_hand,par_level")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .single();

    if (inv2Err) return NextResponse.json({ ok: false, error: inv2Err.message }, { status: 500 });

    const current = Number(inv2.on_hand ?? 0);
    const nextOnHand = mode === "USE" ? Math.max(0, current - qty) : current + qty;

    // Update row
    const { error: updErr } = await supabaseAdmin
      .from("storage_inventory")
      .update({
        on_hand: nextOnHand,
        updated_at: new Date().toISOString(),
      })
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

    // Optional audit log
    try {
      await supabaseAdmin.from("inventory_events").insert({
        event_type: mode,
        item_id,
        storage_area_id,
        qty,
        note: mainOverride ? "MAIN override" : null,
      });
    } catch {}

    return NextResponse.json({ ok: true, on_hand: nextOnHand }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
