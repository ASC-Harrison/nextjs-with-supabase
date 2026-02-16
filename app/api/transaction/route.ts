// app/api/transaction/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Body = {
  itemQuery: string; // name or barcode
  locationId: string; // uuid
  mode: "use" | "restock";
  qty: number;
};

function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return json(500, { ok: false, error: "Missing Supabase env vars" });
    }

    if (!body?.locationId) return json(400, { ok: false, error: "Missing locationId" });
    if (!body?.itemQuery?.trim()) return json(400, { ok: false, error: "Missing itemQuery" });

    const qty = Number(body.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return json(400, { ok: false, error: "Qty must be a number > 0" });
    }

    const mode = body.mode === "restock" ? "restock" : "use";

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Find item by barcode OR name (case-insensitive)
    const q = body.itemQuery.trim();

    const { data: itemByBarcode } = await supabase
      .from("items")
      .select("id,name,barcode")
      .eq("barcode", q)
      .maybeSingle();

    let item = itemByBarcode;

    if (!item) {
      const { data: itemByName, error: nameErr } = await supabase
        .from("items")
        .select("id,name,barcode")
        .ilike("name", q)
        .maybeSingle();

      if (nameErr) return json(500, { ok: false, error: nameErr.message });
      item = itemByName ?? null;
    }

    if (!item) {
      return json(404, { ok: false, error: "Item not found (name or barcode)" });
    }

    // 2) Get existing row in inventory for this item+location
    const { data: row, error: rowErr } = await supabase
      .from("inventory")
      .select("id,on_hand")
      .eq("item_id", item.id)
      .eq("location_id", body.locationId)
      .maybeSingle();

    if (rowErr) return json(500, { ok: false, error: rowErr.message });

    const current = Number(row?.on_hand ?? 0);
    const next = mode === "use" ? current - qty : current + qty;

    if (mode === "use" && next < 0) {
      return json(400, { ok: false, error: `Not enough on hand (have ${current})` });
    }

    // 3) Upsert inventory row
    const { error: upsertErr } = await supabase
      .from("inventory")
      .upsert(
        {
          id: row?.id, // if exists, update
          item_id: item.id,
          location_id: body.locationId,
          on_hand: next,
          status: "OK",
        },
        { onConflict: "item_id,location_id" }
      );

    if (upsertErr) return json(500, { ok: false, error: upsertErr.message });

    return json(200, {
      ok: true,
      item: { id: item.id, name: item.name, barcode: item.barcode },
      locationId: body.locationId,
      mode,
      qty,
      before: current,
      after: next,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message ?? "Unknown error" });
  }
}
