// lib/utils.ts
import { createClient } from "@/lib/supabase/server";

export type ScanType = "IN" | "OUT";

const MAKE_LOW_STOCK_WEBHOOK =
  "https://hook.us2.make.com/dylcjaplrj98jwqksiwjbq9x1fwg1lau";

/**
 * Safe int parser so qty doesn't turn into weird values.
 */
function toQty(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.floor(n);
  return int >= 1 ? int : fallback;
}

/**
 * Sends the Make webhook (fire and forget).
 */
async function sendLowStockWebhook(payload: Record<string, any>) {
  try {
    await fetch(MAKE_LOW_STOCK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Don't break scanning if Make is down
    console.error("Make webhook failed:", e);
  }
}

/**
 * The ONE function your app should use for scanning.
 * - Correct qty math
 * - No duplicates
 * - Only triggers low-stock email when it becomes LOW
 */
export async function submitScan(params: {
  locationName: string;
  barcode: string;
  type: ScanType;
  qty: number | string;
}) {
  const supabase = await createClient();

  const locationName = (params.locationName || "").trim();
  const barcode = (params.barcode || "").trim();
  const type = (params.type || "OUT").toUpperCase() as ScanType;
  const qty = toQty(params.qty, 1);

  if (!locationName) throw new Error("Location is required.");
  if (!barcode) throw new Error("Barcode is required.");
  if (type !== "IN" && type !== "OUT") throw new Error("Type must be IN or OUT.");

  // Call the Postgres function we created
  const { data, error } = await supabase.rpc("scan_inventory", {
    p_barcode: barcode,
    p_location_name: locationName,
    p_type: type,
    p_qty: qty,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("No response from scan_inventory.");

  // If it JUST became LOW, fetch details and send webhook
  if (row.became_low) {
    // Pull item + location info so email can show names
    const [{ data: item }, { data: loc }] = await Promise.all([
      supabase
        .from("items")
        .select("id, name, barcode, par_level, low_level")
        .eq("id", row.item_id)
        .single(),
      supabase
        .from("locations")
        .select("id, name")
        .eq("id", row.location_id)
        .single(),
    ]);

    await sendLowStockWebhook({
      event: "LOW_STOCK",
      item_id: row.item_id,
      location_id: row.location_id,
      item_name: item?.name ?? "",
      barcode: item?.barcode ?? barcode,
      location_name: loc?.name ?? locationName,
      on_hand: row.on_hand,
      par_level: item?.par_level ?? 0,
      low_level: item?.low_level ?? 0,
      status: row.status,
      happened_at: new Date().toISOString(),
    });
  }

  return {
    on_hand: row.on_hand as number,
    status: row.status as string,
    became_low: !!row.became_low,
  };
}

/**
 * Low stock list for your /low-stock page
 */
export async function getLowStockItems() {
  const supabase = await createClient();

  // join inventory -> items + locations
  const { data, error } = await supabase
    .from("inventory")
    .select(
      `
      on_hand,
      status,
      updated_at,
      items!inner ( id, name, barcode, par_level, low_level ),
      locations!inner ( id, name )
    `
    )
    .eq("status", "LOW")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    item_id: r.items?.id,
    item_name: r.items?.name,
    barcode: r.items?.barcode,
    location_id: r.locations?.id,
    location_name: r.locations?.name,
    on_hand: r.on_hand,
    par_level: r.items?.par_level ?? 0,
    low_level: r.items?.low_level ?? 0,
    updated_at: r.updated_at,
  }));
}

