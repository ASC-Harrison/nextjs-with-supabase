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

function getBaseUrl(req: Request) {
  // Works in Vercel + local
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return null;
  return `${proto}://${host}`;
}

export async function GET() {
  return json(200, { ok: true, route: "/api/transaction" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const location = String(body.location ?? "").trim(); // must match storage_areas.name
    const mode = String(body.mode ?? "").trim().toUpperCase(); // USE | RESTOCK
    const itemOrBarcode = String(body.itemOrBarcode ?? "").trim();
    const qty = Math.max(1, Number(body.qty ?? 1) || 1);

    if (!location) return json(400, { ok: false, error: "Missing location" });
    if (mode !== "USE" && mode !== "RESTOCK") return json(400, { ok: false, error: "Mode must be USE or RESTOCK" });
    if (!itemOrBarcode) return json(400, { ok: false, error: "Missing itemOrBarcode" });

    // 1) Find storage area by name
    const { data: area, error: areaErr } = await supabase
      .from("storage_areas")
      .select("id, name")
      .ilike("name", location)
      .maybeSingle();

    if (areaErr) return json(500, { ok: false, error: `storage_areas lookup failed: ${areaErr.message}` });
    if (!area) return json(404, { ok: false, error: `Storage area not found: ${location}` });

    // 2) Find item by barcode exact OR name contains
    const needle = itemOrBarcode;

    let { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .eq("barcode", needle)
      .maybeSingle();

    if (itemErr) return json(500, { ok: false, error: `Item lookup failed: ${itemErr.message}` });

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

    // 3) Read current cabinet stock row
    const { data: row, error: rowErr } = await supabase
      .from("storage_inventory")
      .select("on_hand, par_level, low, low_notified")
      .eq("storage_area_id", area.id)
      .eq("item_id", item.id)
      .maybeSingle();

    if (rowErr) return json(500, { ok: false, error: `storage_inventory read failed: ${rowErr.message}` });

    const oldOnHand = Number(row?.on_hand ?? 0);
    const parLevel = Number(row?.par_level ?? 0);

    const newOnHand = mode === "USE" ? oldOnHand - qty : oldOnHand + qty;

    if (newOnHand < 0) {
      return json(400, {
        ok: false,
        error: `Not enough stock in ${area.name}. On hand ${oldOnHand}, tried to use ${qty}.`,
      });
    }

    const isLow = parLevel > 0 ? newOnHand < parLevel : false;

    // If restocked back to par or above, allow future alerts again
    const shouldResetNotified = parLevel > 0 && newOnHand >= parLevel;

    const { data: saved, error: upErr } = await supabase
      .from("storage_inventory")
      .upsert(
        {
          storage_area_id: area.id,
          item_id: item.id,
          on_hand: newOnHand,
          par_level: parLevel,
          low: isLow,
          low_notified: shouldResetNotified ? false : Boolean(row?.low_notified ?? false),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "storage_area_id,item_id" }
      )
      .select("on_hand, par_level, low, low_notified")
      .single();

    if (upErr) return json(500, { ok: false, error: `storage_inventory upsert failed: ${upErr.message}` });

    // 4) Trigger email check (best-effort)
    try {
      const baseUrl = getBaseUrl(req);
      if (baseUrl) {
        await fetch(`${baseUrl}/api/notify-low-stock`, { method: "POST" });
      }
    } catch {}

    // 5) Optional transaction log (ignore if your schema differs)
    try {
      await supabase.from("transactions").insert({
        item_id: item.id,
        storage_area_id: area.id,
        mode,
        qty,
        created_at: new Date().toISOString(),
      });
    } catch {}

    return json(200, {
      ok: true,
      item,
      location: area,
      old_on_hand: oldOnHand,
      new_on_hand: saved.on_hand,
      low: saved.low,
      par_level: saved.par_level,
      low_notified: saved.low_notified,
    });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message ?? "Server error" });
  }
}
