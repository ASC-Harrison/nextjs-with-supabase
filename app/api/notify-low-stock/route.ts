import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/notify-low-stock" });
}

export async function POST() {
  try {
    const to = (process.env.LOW_STOCK_EMAIL_TO || "").trim();
    const from = (process.env.LOW_STOCK_EMAIL_FROM || "Inventory Alerts <onboarding@resend.dev>").trim();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_TO" }, { status: 500 });
    }

    // 1) Pull low + not notified rows
    const { data: lows, error: lowErr } = await supabase
      .from("storage_inventory")
      .select("storage_area_id, item_id, on_hand, par_level, low, low_notified")
      .eq("low", true)
      .eq("low_notified", false);

    if (lowErr) return NextResponse.json({ ok: false, error: lowErr.message }, { status: 500 });

    if (!lows || lows.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No new low stock items" });
    }

    // 2) Load item + area names
    const itemIds = Array.from(new Set(lows.map((r) => r.item_id)));
    const areaIds = Array.from(new Set(lows.map((r) => r.storage_area_id)));

    const [{ data: items, error: itemsErr }, { data: areas, error: areasErr }] = await Promise.all([
      supabase.from("items").select("id, name, barcode").in("id", itemIds),
      supabase.from("storage_areas").select("id, name").in("id", areaIds),
    ]);

    if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
    if (areasErr) return NextResponse.json({ ok: false, error: areasErr.message }, { status: 500 });

    const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
    const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));

    // 3) Build email
    const lines = lows
      .map((r) => {
        const item = itemMap.get(r.item_id);
        const area = areaMap.get(r.storage_area_id);
        const name = item?.name ?? "Unknown Item";
        const barcode = item?.barcode ? ` (barcode: ${item.barcode})` : "";
        const where = area?.name ?? "Unknown Area";
        return `• ${name}${barcode} — ${where}: ${r.on_hand} on hand (par ${r.par_level})`;
      })
      .join("\n");

    const subject = `LOW STOCK (${lows.length})`;
    const text =
      `The following items are below par:\n\n` +
      `${lines}\n\n` +
      `This alert will not repeat until the item is restocked to par (or above).`;

    await resend.emails.send({
      from,
      to,
      subject,
      text,
    });

    // 4) Mark notified
    for (const r of lows) {
      const { error: updErr } = await supabase
        .from("storage_inventory")
        .update({ low_notified: true })
        .eq("storage_area_id", r.storage_area_id)
        .eq("item_id", r.item_id);

      if (updErr) {
        // keep going; we already sent email
        console.error("Failed to set low_notified:", updErr.message);
      }
    }

    return NextResponse.json({ ok: true, sent: lows.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
