import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Body = {
  itemQuery: string;
  qty: number;
  action: "USE" | "RESTOCK";
  locationId: string | null;
  overrideMainOnce?: boolean;
};

async function findItemId(itemQuery: string): Promise<string | null> {
  const q = itemQuery.trim();

  // 1) Try internal barcode in items.barcode
  {
    const { data } = await supabase
      .from("items")
      .select("id")
      .eq("barcode", q)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 2) Try alias barcode in item_barcodes
  {
    const { data, error } = await supabase
      .from("item_barcodes")
      .select("item_id")
      .eq("barcode", q)
      .limit(1)
      .maybeSingle();

    if (!error && data?.item_id) return data.item_id;
  }

  // 3) Try name search (only if it doesn't look like a long barcode)
  const looksLikeBarcode = /^[A-Za-z0-9\-\_]{6,}$/.test(q) && /\d/.test(q);
  if (!looksLikeBarcode) {
    const { data } = await supabase
      .from("items")
      .select("id")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const itemQuery = (body.itemQuery || "").trim();
    const qty = Math.max(1, Math.floor(Number(body.qty || 1)));
    const action = body.action;
    let locationId = body.locationId;

    if (!itemQuery) {
      return NextResponse.json({ ok: false, error: "Missing itemQuery" }, { status: 400 });
    }
    if (action !== "USE" && action !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Bad action" }, { status: 400 });
    }

    // If you want “MAIN override” logic by name, do it here.
    // For now, if overrideMainOnce is true and MAIN exists, use it.
    if (body.overrideMainOnce) {
      const { data: main } = await supabase
        .from("storage_areas")
        .select("id")
        .ilike("name", "%main%")
        .limit(1)
        .maybeSingle();
      if (main?.id) locationId = main.id;
    }

    if (!locationId) {
      return NextResponse.json({ ok: false, error: "Missing locationId" }, { status: 400 });
    }

    const itemId = await findItemId(itemQuery);

    if (!itemId) {
      return NextResponse.json(
        { ok: false, code: "ITEM_NOT_FOUND", scanned: itemQuery, error: "Not in system" },
        { status: 404 }
      );
    }

    // Ensure row exists in storage_inventory, then update on_hand
    const { data: existing, error: selErr } = await supabase
      .from("storage_inventory")
      .select("id,on_hand")
      .eq("item_id", itemId)
      .eq("storage_area_id", locationId)
      .limit(1)
      .maybeSingle();

    if (selErr) throw selErr;

    const current = Number(existing?.on_hand || 0);
    const next = action === "USE" ? Math.max(0, current - qty) : current + qty;

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("storage_inventory")
        .update({ on_hand: next })
        .eq("id", existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("storage_inventory").insert({
        item_id: itemId,
        storage_area_id: locationId,
        on_hand: next,
      });
      if (insErr) throw insErr;
    }

    // Optional transaction log (if you have the table)
    await supabase.from("transactions").insert({
      item_id: itemId,
      storage_area_id: locationId,
      qty,
      mode: action,
    });

    return NextResponse.json({ ok: true, message: "Updated", on_hand: next });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
