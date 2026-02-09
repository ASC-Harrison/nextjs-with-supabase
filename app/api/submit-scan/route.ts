import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const storage_area_id = String(body.storage_area_id || "").trim();
    const item_id = String(body.item_id || "").trim();
    const qty = Number(body.qty);
    const mode = String(body.mode || "").toUpperCase(); // USE or RESTOCK

    if (!storage_area_id || !item_id || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    // Get current row (if exists)
    const { data: existing, error: readErr } = await supabase
      .from("storage_inventory")
      .select("storage_area_id,item_id,on_hand,par_level,low,low_notified")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }

    const current = existing?.on_hand ?? 0;
    const next = mode === "USE" ? Math.max(0, current - qty) : current + qty;

    // Compute low flag (if par_level is present)
    const par = existing?.par_level ?? 0;
    const low = par > 0 ? next <= par : false;

    if (!existing) {
      // insert new row
      const { error: insErr } = await supabase.from("storage_inventory").insert({
        storage_area_id,
        item_id,
        on_hand: next,
        par_level: 0,
        low,
        low_notified: false,
      });

      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
    } else {
      // update existing row
      const { error: updErr } = await supabase
        .from("storage_inventory")
        .update({
          on_hand: next,
          low,
          // if it recovered above par, reset notified so it can alert again next time
          low_notified: low ? existing.low_notified : false,
        })
        .eq("storage_area_id", storage_area_id)
        .eq("item_id", item_id);

      if (updErr) {
        return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, on_hand: next, low });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
