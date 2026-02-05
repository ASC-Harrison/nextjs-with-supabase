import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = await req.json();

    const barcode = String(body.barcode ?? "").trim();
    const locationId = String(body.location_id ?? "").trim(); // ✅ IMPORTANT: location_id
    const qty = Number(body.qty ?? 0);
    const direction = body.direction === "IN" ? "IN" : "OUT";

    if (!barcode) return Response.json({ ok: false, error: "Missing barcode" }, { status: 400 });
    if (!locationId) return Response.json({ ok: false, error: "Missing location_id" }, { status: 400 });
    if (!Number.isFinite(qty) || qty <= 0) return Response.json({ ok: false, error: "Qty must be > 0" }, { status: 400 });

    // 1) Find item by barcode
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name")
      .eq("barcode", barcode)
      .maybeSingle();

    if (itemErr) throw itemErr;
    if (!item) {
      return Response.json({ ok: false, error: "Item not found for this barcode", barcode }, { status: 404 });
    }

    // 2) Find inventory row by item_id + location_id
    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("id, on_hand, par_level")
      .eq("item_id", item.id)
      .eq("location_id", locationId)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!inv) {
      return Response.json(
        { ok: false, error: "Item not found for this barcode + location_id", barcode, location_id: locationId },
        { status: 404 }
      );
    }

    const current = Number(inv.on_hand ?? 0);
    const updated = direction === "OUT" ? Math.max(0, current - qty) : current + qty;

    const { error: updErr } = await supabase
      .from("inventory")
      .update({ on_hand: updated })
      .eq("id", inv.id);

    if (updErr) throw updErr;

    // 3) Run low-stock email check (won’t spam)
    await fetch(new URL("/api/notify-low-stock", req.url), { method: "POST" });

    return Response.json({
      ok: true,
      item: { id: item.id, name: item.name },
      barcode,
      location_id: locationId,
      direction,
      qty,
      on_hand_before: current,
      on_hand_after: updated,
    });
  } catch (err: any) {
    console.error("submit-scan error:", err);
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
