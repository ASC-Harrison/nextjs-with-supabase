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
  mode: "USE" | "RESTOCK";
  storage_area_id: string;
};

async function findItemId(itemQuery: string): Promise<string | null> {
  const q = itemQuery.trim();

  // 1) Try internal barcode in items.barcode (exact)
  {
    const { data } = await supabase
      .from("items")
      .select("id")
      .eq("barcode", q)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  // 2) Try alias barcode table item_barcodes.barcode (exact)
  // If you haven't created item_barcodes yet, this will just fail and we ignore it.
  {
    const { data, error } = await supabase
      .from("item_barcodes")
      .select("item_id")
      .eq("barcode", q)
      .limit(1)
      .maybeSingle();

    if (!error && data?.item_id) return data.item_id;
  }

  // 3) If it isn't barcode-like, try name search (loose)
  // If someone types "glove" we can find by name.
  // For RANDOM numeric barcodes, we do NOT want to accidentally match by name.
  const looksLikeBarcode = /^[A-Za-z0-9\-\_]{6,}$/.test(q) && /\d/.test(q);
  if (!looksLikeBarcode) {
    const { data } = await supabase
      .from("items")
      .select("id")
      .ilike("name", `%${q}%`)
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
    const qty = Number(body.qty || 0);
    const mode = body.mode;
    const storage_area_id = body.storage_area_id;

    if (!itemQuery) {
      return NextResponse.json(
        { ok: false, code: "MISSING_ITEM", error: "Missing itemQuery" },
        { status: 400 }
      );
    }
    if (!storage_area_id) {
      return NextResponse.json(
        { ok: false, code: "MISSING_LOCATION", error: "Missing storage_area_id" },
        { status: 400 }
      );
    }
    if (!qty || qty < 1) {
      return NextResponse.json(
        { ok: false, code: "BAD_QTY", error: "Qty must be 1+" },
        { status: 400 }
      );
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json(
        { ok: false, code: "BAD_MODE", error: "Mode must be USE or RESTOCK" },
        { status: 400 }
      );
    }

    const itemId = await findItemId(itemQuery);

    // ✅ This is the key: return a clear "NOT IN SYSTEM" response
    if (!itemId) {
      return NextResponse.json(
        {
          ok: false,
          code: "ITEM_NOT_FOUND",
          error: "Item/barcode not found in system.",
          scanned: itemQuery,
        },
        { status: 404 }
      );
    }

    // Upsert row in storage_inventory then adjust on_hand
    // Assumes your storage_inventory table has: item_id, storage_area_id, on_hand
    const { data: existing, error: selErr } = await supabase
      .from("storage_inventory")
      .select("id,on_hand")
      .eq("item_id", itemId)
      .eq("storage_area_id", storage_area_id)
      .limit(1)
      .maybeSingle();

    if (selErr) throw selErr;

    const current = Number(existing?.on_hand || 0);
    const next =
      mode === "USE" ? Math.max(0, current - qty) : Math.max(0, current + qty);

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("storage_inventory")
        .update({ on_hand: next })
        .eq("id", existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("storage_inventory").insert({
        item_id: itemId,
        storage_area_id,
        on_hand: next,
      });
      if (insErr) throw insErr;
    }

    // Optional: log transaction
    // If your transactions table differs, remove this block.
    await supabase.from("transactions").insert({
      item_id: itemId,
      storage_area_id,
      qty,
      mode,
    });

    return NextResponse.json({ ok: true, item_id: itemId, on_hand: next });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
