import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  return json(200, { ok: true, route: "/api/transaction" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { location, mode, itemOrBarcode, qty } = body ?? {};

    if (!location || typeof location !== "string") {
      return json(400, { ok: false, error: "Missing location" });
    }
    if (!mode || (mode !== "USE" && mode !== "RESTOCK")) {
      return json(400, { ok: false, error: "Mode must be USE or RESTOCK" });
    }
    if (!itemOrBarcode || typeof itemOrBarcode !== "string") {
      return json(400, { ok: false, error: "Missing itemOrBarcode" });
    }

    const nQty = Math.max(1, Number(qty) || 1);

    // 1) Find storage area by name (MUST match your dropdown text)
    const { data: area, error: areaErr } = await supabase
      .from("storage_areas")
      .select("id, name")
      .ilike("name", location)
      .maybeSingle();

    if (areaErr) return json(500, { ok: false, error: `storage_areas lookup failed: ${areaErr.message}` });
    if (!area) return json(404, { ok: false, error: `Storage area not found: ${location}` });

    // 2) Find item by barcode exact OR name fuzzy
    const needle = itemOrBarcode.trim();

    // Try barcode exact first
    let { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .eq("barcode", needle)
      .maybeSingle();

    if (itemErr) return json(500, { ok: false, error: `Item lookup failed: ${itemErr.message}` });

    // If not barcode match, try name match
    if (!item) {
      const r = await supabase
        .from("items")
        .select("id, name, barcode")
        .ilike("name", `%${needle}%`)
        .order("name", { ascending: true })
        .limit(1);

      if (r.error) return json(500, { ok: false, error: `Item lookup failed: ${r.error.message}` });
      item = r.data?.[0] ?? null;
    }

    if (!item) return json(404, { ok: false, error: `Item not found: ${needle}` });

    // 3) Load current storage_inventory row (area + item)
    const { data: currentRow, error: curErr } = await supabase
      .from("storage_inventory")
      .select("on_hand, par_level, low, low_notified")
      .eq("storage_area_id", area.id)
      .eq("item_id", item.id)
      .maybeSingle();

    if (curErr) return json(500, { ok: false, error: `storage_inventory read failed: ${curErr.message}` });

    const oldOnHand = Number(currentRow?.on_hand ?? 0);
    const delta = mode === "USE" ? -nQty : +nQty;
    const newOnHand = oldOnHand + delta;

    if (newOnHand < 0) {
      return json(400, {
        ok: false,
        error: `Not enough stock in ${area.name}. On hand ${oldOnHand}, tried to use ${nQty}.`,
      });
    }

    // 4) Upsert the row (requires unique constraint on (storage_area_id, item_id))
    const parLevel = Number(currentRow?.par_level ?? 0);
    const isLow = parLevel > 0 ? newOnHand < parLevel : false;

    const { data: upserted, error: upErr } = await supabase
      .from("storage_inventory")
      .upsert(
        {
          storage_area_id: area.id,
          item_id: item.id,
          on_hand: newOnHand,
          par_level: parLevel,
          low: isLow,
          // if we restock above par, clear low_notified so it can alert again later
          low_notified: isLow ? Boolean(currentRow?.low_notified ?? false) : false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "storage_area_id,item_id" }
      )
      .select("on_hand, par_level, low, low_notified")
      .single();

    if (upErr) return json(500, { ok: false, error: `storage_inventory upsert failed: ${upErr.message}` });

    // 5) Optional: write transaction log if your table exists (ignore if not)
    // If your transactions schema differs, we can adjust later.
    await supabase.from("transactions").insert({
      item_id: item.id,
      // some setups use storage_area_id instead of location_id
      storage_area_id: area.id,
      mode,
      qty: nQty,
      created_at: new Date().toISOString(),
    });

    return json(200, {
      ok: true,
      item,
      location: area,
      old_on_hand: oldOnHand,
      new_on_hand: upserted.on_hand,
      low: upserted.low,
      par_level: upserted.par_level,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message ?? "Unknown error" });
  }
}
