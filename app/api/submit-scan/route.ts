import { createClient } from "@supabase/supabase-js";

function clean(v: any) {
  return String(v ?? "").trim();
}
function toInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = await req.json();

    const barcode = clean(body.barcode);
    const location_id = clean(body.location_id); // ✅
    const qty = toInt(body.qty);
    const direction = body.direction === "IN" ? "IN" : "OUT";

    if (!barcode) return Response.json({ ok: false, error: "Missing barcode" }, { status: 400 });
    if (!location_id) return Response.json({ ok: false, error: "Missing location_id" }, { status: 400 });
    if (qty <= 0) return Response.json({ ok: false, error: "Qty must be > 0" }, { status: 400 });

    // 1) Find item by barcode
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .eq("barcode", barcode)
      .maybeSingle();

    if (itemErr) throw itemErr;
    if (!item) {
      return Response.json(
        { ok: false, error: "Item not found for this barcode", barcode },
        { status: 404 }
      );
    }

    // 2) Find inventory row by item_id + location_id
    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("id, on_hand, par_level")
      .eq("item_id", item.id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!inv) {
      return Response.json(
        { ok: false, error: "Item not found for this barcode + location_id", barcode, location_id },
        { status: 404 }
      );
    }

    const current = toInt(inv.on_hand);
    const updated = direction === "OUT" ? Math.max(0, current - qty) : current + qty;

    const { error: updErr } = await supabase
      .from("inventory")
      .update({ on_hand: updated })
      .eq("id", inv.id);

    if (updErr) throw updErr;

    // 3) Trigger low stock checker (email may send if newly low)
    await fetch(new URL("/api/notify-low-stock", req.url), { method: "POST" });

    return Response.json({
      ok: true,
      item: { id: item.id, name: item.name, barcode: item.barcode },
      location_id,
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
