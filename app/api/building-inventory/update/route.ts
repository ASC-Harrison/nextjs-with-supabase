import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item_id = String(body?.item_id ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!item_id) {
      return NextResponse.json({ ok: false, error: "Missing item_id" });
    }
    if (!action) {
      return NextResponse.json({ ok: false, error: "Missing action" });
    }

    const supabase = getServiceClient();

    // Verify item exists
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id,name")
      .eq("id", item_id)
      .maybeSingle();

    if (itemErr) {
      return NextResponse.json({ ok: false, error: `Item lookup failed: ${itemErr.message}` });
    }
    if (!item?.id) {
      return NextResponse.json({ ok: false, error: `Item not found for item_id: ${item_id}` });
    }

    // ============ SET (direct on-hand entry — makes the TOTAL equal this exact number) ============
    if (action === "SET") {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ ok: false, error: `SET value must be a number >= 0. Got: ${body.value}` });
      }

      const onHand = Math.trunc(value);

      // Put the full number in Main Supply
      const { error: upsertError } = await supabase
        .from("storage_inventory")
        .upsert(
          { item_id, storage_area_id: MAIN_SUPPLY_ID, on_hand: onHand, updated_at: new Date().toISOString() },
          { onConflict: "item_id,storage_area_id" }
        );

      if (upsertError) {
        return NextResponse.json({ ok: false, error: `storage_inventory upsert failed: ${upsertError.message}` });
      }

      // Zero out any leftover amounts sitting in OTHER areas for this item,
      // so the displayed TOTAL actually equals the number that was typed.
      const { error: zeroOthersErr } = await supabase
        .from("storage_inventory")
        .update({ on_hand: 0, updated_at: new Date().toISOString() })
        .eq("item_id", item_id)
        .neq("storage_area_id", MAIN_SUPPLY_ID);

      if (zeroOthersErr) {
        return NextResponse.json({ ok: false, error: `Failed to clear other areas: ${zeroOthersErr.message}` });
      }

      // Force-sync building_totals immediately so the UI shows the correct number right away
      const { data: allRows } = await supabase
        .from("storage_inventory")
        .select("on_hand")
        .eq("item_id", item_id);

      const total = (allRows || []).reduce((sum: number, r: any) => sum + (Number(r.on_hand) || 0), 0);

      await supabase
        .from("building_totals")
        .upsert({ item_id, building_on_hand: total }, { onConflict: "item_id" });

      // Permanent history log tied to item_id — never text-parsed, always reliable
      await supabase.from("inventory_history").insert({
        item_id,
        item_name: item.name,
        on_hand: total,
        changed_by: body.changed_by || "Unknown",
        change_type: "SET",
      });

      return NextResponse.json({ ok: true, on_hand: onHand, total });
    }

    // ============ ADJUST (+/- delta) ============
    if (action === "ADJUST") {
      const delta = Number(body.delta);
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ ok: false, error: `ADJUST delta must be non-zero. Got: ${body.delta}` });
      }

      const { data: mainRow, error: mainErr } = await supabase
        .from("storage_inventory")
        .select("on_hand")
        .eq("item_id", item_id)
        .eq("storage_area_id", MAIN_SUPPLY_ID)
        .maybeSingle();

      if (mainErr) {
        return NextResponse.json({ ok: false, error: `Read failed: ${mainErr.message}` });
      }

      const current = Number(mainRow?.on_hand ?? 0);
      const next = Math.max(0, current + Math.trunc(delta));

      const { error: upsertError } = await supabase
        .from("storage_inventory")
        .upsert(
          { item_id, storage_area_id: MAIN_SUPPLY_ID, on_hand: next, updated_at: new Date().toISOString() },
          { onConflict: "item_id,storage_area_id" }
        );

      if (upsertError) {
        return NextResponse.json({ ok: false, error: `storage_inventory upsert failed: ${upsertError.message}` });
      }

      const { data: allRows } = await supabase
        .from("storage_inventory")
        .select("on_hand")
        .eq("item_id", item_id);

      const total = (allRows || []).reduce((sum: number, r: any) => sum + (Number(r.on_hand) || 0), 0);

      await supabase
        .from("building_totals")
        .upsert({ item_id, building_on_hand: total }, { onConflict: "item_id" });

      // Permanent history log tied to item_id
      await supabase.from("inventory_history").insert({
        item_id,
        item_name: item.name,
        on_hand: total,
        changed_by: body.changed_by || "Unknown",
        change_type: "ADJUST",
      });

      return NextResponse.json({ ok: true, on_hand: next, total });
    }

    // ============ SET_PAR ============
    if (action === "SET_PAR") {
      const par = Number(body.par_level);
      if (!Number.isFinite(par) || par < 0) {
        return NextResponse.json({ ok: false, error: "par_level must be a number >= 0" });
      }
      const { error } = await supabase.from("items").update({ par_level: Math.trunc(par) }).eq("id", item_id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    // ============ SET_ACTIVE ============
    if (action === "SET_ACTIVE") {
      const is_active = Boolean(body.is_active);
      const { error } = await supabase.from("items").update({ is_active }).eq("id", item_id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    // ============ SAVE_PRICE_NOTE ============
    if (action === "SAVE_PRICE_NOTE") {
      const priceNote: Record<string, any> = {};
      if (body.price !== undefined) {
        const p = Number(body.price);
        priceNote.price = Number.isFinite(p) && p >= 0 ? p : null;
      }
      if (body.alert_note !== undefined) {
        priceNote.alert_note = body.alert_note || null;
      }
      if (Object.keys(priceNote).length === 0) return NextResponse.json({ ok: true });
      const { error } = await supabase.from("items").update(priceNote).eq("id", item_id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    // ============ SAVE_ITEM_META ============
    if (action === "SAVE_ITEM_META") {
      const low = Number(body.low_level);
      if (!Number.isFinite(low) || low < 0) {
        return NextResponse.json({ ok: false, error: "low_level must be a number >= 0" });
      }

      const payload: Record<string, any> = {
        vendor: typeof body.vendor === "string" ? body.vendor.trim() || null : null,
        category: typeof body.category === "string" ? body.category.trim() || null : null,
        unit: typeof body.unit === "string" ? body.unit.trim() || null : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        low_level: Math.trunc(low),
        reference_number: typeof body.reference_number_new === "string" ? body.reference_number_new.trim() || null : null,
      };

      if (typeof body.supply_source === "string") payload.supply_source = body.supply_source.trim() || null;
      if (body.price !== undefined) {
        const p = Number(body.price);
        payload.price = Number.isFinite(p) && p >= 0 ? p : null;
      }
      if (body.expiration_date !== undefined) payload.expiration_date = body.expiration_date || null;
      if (body.alert_note !== undefined) payload.alert_note = body.alert_note || null;

      const { error } = await supabase.from("items").update(payload).eq("id", item_id);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown server error" });
  }
}
