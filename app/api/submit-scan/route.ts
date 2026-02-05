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

    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .eq("barcode", barcode)
      .single();

    if (itemErr || !item) return Response.json({ error: "Item not found for this barcode" }, { status: 404 });

    // Find inventory row by composite key
    let { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("on_hand, par_level, low_stock_notified")
      .eq("item_id", item.id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (invErr) throw invErr;

    // auto-create if missing
    if (!inv) {
      const { data: created, error: createErr } = await supabase
        .from("inventory")
        .insert({
          item_id: item.id,
          location_id,
          on_hand: 0,
          par_level: 0,
          status: "OK",
          low_stock: false,
          low_stock_notified: false,
        })
        .select("on_hand, par_level, low_stock_notified")
        .single();

      if (createErr) throw createErr;
      inv = created;
    }

    const current = Number(inv.on_hand ?? 0);
    const par = Number(inv.par_level ?? 0);
    const updated = direction === "OUT" ? Math.max(0, current - qty) : current + qty;

    // LOW when on_hand <= par_level (and par_level > 0)
    const isLow = par > 0 && updated <= par;

    // Reset low_stock_notified when restocked above par level
    const isRestocked = updated > par;

    const { error: updErr } = await supabase
      .from("inventory")
      .update({
        on_hand: updated,
        low_stock: isLow,
        status: isLow ? "LOW" : "OK",
        // Reset notified when restocked above par
        low_stock_notified: isLow ? inv.low_stock_notified : false,
      })
      .eq("item_id", item.id)
      .eq("location_id", location_id);

    if (updErr) throw updErr;

    if (isLow && !inv.low_stock_notified) {
      // Trigger low-stock notifier if it's a first-time low
      await fetch(new URL("/api/notify-low-stock", req.url), { method: "POST" });
    }

    return Response.json({
      ok: true,
      item: item.name,
      before: current,
      after: updated,
      par_level: par,
      low_stock: isLow,
      restocked: isRestocked,
    });
  } catch (err: any) {
    console.error("submit-scan error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
