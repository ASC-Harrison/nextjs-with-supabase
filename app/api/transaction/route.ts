import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

function toInt(value: unknown, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/transaction" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mode = String(body.mode ?? "USE").toUpperCase(); // USE or RESTOCK
    const qty = Math.max(1, toInt(body.qty, 1));
    const itemOrBarcode = String(body.itemOrBarcode ?? "").trim();
    const locationName = String(body.location ?? "").trim();

    if (!itemOrBarcode) {
      return NextResponse.json({ ok: false, error: "Missing itemOrBarcode" }, { status: 400 });
    }
    if (!locationName) {
      return NextResponse.json({ ok: false, error: "Missing location" }, { status: 400 });
    }
    if (mode !== "USE" && mode !== "RESTOCK") {
      return NextResponse.json({ ok: false, error: "Mode must be USE or RESTOCK" }, { status: 400 });
    }

    // 1) Look up location_id from locations table (match by name)
    // If your column is not "name", change it here.
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .select("id, name")
      .ilike("name", locationName)
      .limit(1)
      .maybeSingle();

    if (locErr) {
      return NextResponse.json({ ok: false, error: `Location lookup error: ${locErr.message}` }, { status: 500 });
    }
    if (!loc?.id) {
      return NextResponse.json(
        { ok: false, error: `Location not found: "${locationName}"` },
        { status: 404 }
      );
    }

    // 2) Look up item_id from items table (barcode exact OR name contains)
    // If your columns are not "barcode" and "name", change them here.
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .or(`barcode.eq.${itemOrBarcode},name.ilike.%${itemOrBarcode}%`)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (itemErr) {
      return NextResponse.json({ ok: false, error: `Item lookup error: ${itemErr.message}` }, { status: 500 });
    }
    if (!item?.id) {
      return NextResponse.json(
        { ok: false, error: `Item not found for: "${itemOrBarcode}"` },
        { status: 404 }
      );
    }

    const item_id = item.id;
    const location_id = loc.id;

    // 3) Read current inventory row
    const { data: invRow, error: invErr } = await supabase
      .from("inventory")
      .select("item_id, location_id, on_hand, status")
      .eq("item_id", item_id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (invErr) {
      return NextResponse.json({ ok: false, error: `Inventory read error: ${invErr.message}` }, { status: 500 });
    }

    const current = Number(invRow?.on_hand ?? 0);
    const delta = mode === "USE" ? -qty : qty;
    const next = Math.max(0, current + delta);

    // 4) Upsert/update inventory
    // (Assumes inventory has a unique constraint on (item_id, location_id). If not, tell me and I’ll adjust.)
    const { data: updated, error: updErr } = await supabase
      .from("inventory")
      .upsert(
        {
          item_id,
          location_id,
          on_hand: next,
          status: "OK",
        },
        { onConflict: "item_id,location_id" }
      )
      .select("item_id, location_id, on_hand, status")
      .single();

    if (updErr) {
      return NextResponse.json({ ok: false, error: `Inventory update error: ${updErr.message}` }, { status: 500 });
    }

    // 5) OPTIONAL: write to transactions table (safe try — won’t break if columns differ)
    // If this fails, we ignore it.
    try {
      await supabase.from("transactions").insert({
        item_id,
        location_id,
        qty,
        mode, // if your table uses "type" instead, change this line
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      mode,
      qty,
      item: { id: item_id, name: item.name, barcode: item.barcode },
      location: { id: location_id, name: loc.name },
      old_on_hand: current,
      new_on_hand: updated.on_hand,
      status: updated.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
