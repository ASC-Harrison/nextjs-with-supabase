import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const barcode = String(body.barcode ?? "").trim();
    const location_id = String(body.location_id ?? "").trim();
    const qty = Number(body.qty ?? 0);
    const direction = body.direction === "IN" ? "IN" : "OUT";

    if (!barcode) return Response.json({ error: "Missing barcode" }, { status: 400 });
    if (!location_id) return Response.json({ error: "Missing location_id" }, { status: 400 });
    if (!Number.isFinite(qty) || qty <= 0) return Response.json({ error: "Qty must be > 0" }, { status: 400 });

    const { data: item } = await supabase
      .from("items")
      .select("id, name")
      .eq("barcode", barcode)
      .single();

    if (!item) return Response.json({ error: "Item not found for this barcode" }, { status: 404 });

    // Read current inventory state
    const { data: inv } = await supabase
      .from("inventory")
      .select("on_hand, par_level, low_stock, low_stock_notified")
      .eq("item_id", item.id)
      .eq("location_id", location_id)
      .single();

    if (!inv) return Response.json({ error: "Inventory row missing for this item/location" }, { status: 404 });

    const beforeOnHand = Number(inv.on_hand ?? 0);
    const par = Number(inv.par_level ?? 0);

    const afterOnHand =
      direction === "OUT"
        ? Math.max(0, beforeOnHand - qty)
        : beforeOnHand + qty;

    const wasLow = !!inv.low_stock;
    const isLow = par > 0 && afterOnHand <= par; // LOW rule

    // Update inventory. IMPORTANT:
    // - do NOT set notified=true here
    // - re-arm when NOT low
    const updatePayload: any = {
      on_hand: afterOnHand,
      low_stock: isLow,
      status: isLow ? "LOW" : "OK",
    };

    if (!isLow) {
      updatePayload.low_stock_notified = false; // ✅ re-arm when restocked above par
    }

    await supabase
      .from("inventory")
      .update(updatePayload)
      .eq("item_id", item.id)
      .eq("location_id", location_id);

    // ✅ Only trigger notify on transition OK -> LOW
    if (!wasLow && isLow) {
      await fetch(new URL("/api/notify-low-stock", req.url), { method: "POST" });
    }

    return Response.json({
      ok: true,
      item: item.name,
      before: beforeOnHand,
      after: afterOnHand,
      par_level: par,
      wasLow,
      isLow,
      low_stock_notified_before: inv.low_stock_notified,
    });
  } catch (err: any) {
    console.error("submit-scan error:", err);
    return Response.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
