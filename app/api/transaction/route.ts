import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  mode: "USE" | "RESTOCK";
  itemQuery: string; // barcode or name text
  qty: number;
  storageAreaId: string; // where to apply it (room cabinet / main)
};

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = (await req.json()) as Body;

    const mode = body.mode;
    const itemQuery = (body.itemQuery ?? "").trim();
    const qty = Number(body.qty ?? 0);
    const storageAreaId = body.storageAreaId;

    if (!itemQuery) {
      return NextResponse.json({ error: "Missing itemQuery" }, { status: 400 });
    }
    if (!storageAreaId) {
      return NextResponse.json({ error: "Missing storageAreaId" }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Qty must be > 0" }, { status: 400 });
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // 1) Find item by barcode exact match OR name ilike
    const isProbablyBarcode = /^[0-9A-Za-z\-\._]{4,}$/.test(itemQuery);

    let itemId: string | null = null;

    if (isProbablyBarcode) {
      const { data: byBarcode } = await supabase
        .from("items")
        .select("id")
        .eq("barcode", itemQuery)
        .limit(1);

      if (byBarcode && byBarcode.length) itemId = byBarcode[0].id;
    }

    if (!itemId) {
      const { data: byName } = await supabase
        .from("items")
        .select("id")
        .ilike("name", `%${itemQuery}%`)
        .limit(1);

      if (byName && byName.length) itemId = byName[0].id;
    }

    if (!itemId) {
      return NextResponse.json(
        { code: "ITEM_NOT_FOUND", scanned: itemQuery },
        { status: 404 }
      );
    }

    // 2) Upsert storage_inventory row if missing, then adjust on_hand
    // storage_inventory: storage_area_id, item_id, on_hand
    const { data: existing, error: existingErr } = await supabase
      .from("storage_inventory")
      .select("storage_area_id,item_id,on_hand")
      .eq("storage_area_id", storageAreaId)
      .eq("item_id", itemId)
      .limit(1);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const currentOnHand = existing?.[0]?.on_hand ?? 0;
    const delta = mode === "USE" ? -qty : qty;
    const nextOnHand = Math.max(0, Number(currentOnHand) + delta);

    if (!existing || existing.length === 0) {
      const { error: insErr } = await supabase.from("storage_inventory").insert({
        storage_area_id: storageAreaId,
        item_id: itemId,
        on_hand: nextOnHand,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    } else {
      const { error: upErr } = await supabase
        .from("storage_inventory")
        .update({ on_hand: nextOnHand })
        .eq("storage_area_id", storageAreaId)
        .eq("item_id", itemId);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Optional: write a transaction row if you have a transactions table
    // (won't break if the table doesn't exist - we just skip it)
    try {
      await supabase.from("transactions").insert({
        storage_area_id: storageAreaId,
        item_id: itemId,
        qty: qty,
        mode: mode,
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        item_id: itemId,
        storage_area_id: storageAreaId,
        on_hand: nextOnHand,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
