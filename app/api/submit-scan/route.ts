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

    // 1) Find item by barcode
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name")
      .eq("barcode", barcode)
      .single();

    if (itemErr || !item) {
      return Response.json({ error: "Item not found for this barcode" }, { status: 404 });
    }

    // 2) Find inventory row by item_id + location_id (your schema)
    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("on_hand, low_stock, low_stock_notified")
      .eq("item_id", item.id)
      .eq("location_id", location_id)
      .single();

    if (invErr || !inv) {
      return Response.json({ error: "Item not found for this barcode + location" }, { status: 404 });
    }

    const current = Number(inv.on_hand ?? 0);
    const updated = direction === "OUT" ? Math.max(0, current - qty) : current + qty;

    // 🔧 Low stock logic:
    // You do NOT have par_level in inventory, so for now we treat "low" as on_hand <= 0.
    // (If you want par levels, we can wire it to products table next.)
    const isLow = updated <= 0;

    // 3) Update by composite keys (item_id + location_id)
    const { error: updErr } = await supabase
      .from("inventory")
      .update({
        on_hand: updated,
        low_stock: isLow,
        // if it is NOT low anymore, clear notified so it can notify next time it goes low
        low_stock_notified: isLow ? inv.low_stock_notified : false,
      })
      .eq("item_id", item.id)
      .eq("location_id", location_id);

    if (updErr) throw updErr;

    // 4) Trigger email check (sends only if low_stock=true and not notified)
    await fetch(new URL("/api/notify-low-stock", req.url), { method: "POST" });

    return Response.json({
      ok: true,
      item: item.name,
      barcode,
      location_id,
      before: current,
      after: updated,
      low_stock: isLow,
    });
  } catch (err: any) {
    console.error("submit-scan error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
