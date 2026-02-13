import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

async function runEmail() {
  const to = process.env.LOW_STOCK_EMAIL_TO;
  const from = process.env.LOW_STOCK_EMAIL_FROM || "Inventory Alerts <onboarding@resend.dev>";

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }
  if (!to) {
    return { ok: false, error: "Missing LOW_STOCK_EMAIL_TO" };
  }

  const { data: lows, error } = await supabase
    .from("storage_inventory")
    .select("storage_area_id, item_id, on_hand, par_level")
    .eq("low", true)
    .eq("low_notified", false);

  if (error) return { ok: false, error: error.message };
  if (!lows || lows.length === 0) {
    return { ok: true, sent: 0, message: "No new low stock items" };
  }

  const itemIds = lows.map((r) => r.item_id);
  const areaIds = lows.map((r) => r.storage_area_id);

  const { data: items } = await supabase
    .from("items")
    .select("id, name")
    .in("id", itemIds);

  const { data: areas } = await supabase
    .from("storage_areas")
    .select("id, name")
    .in("id", areaIds);

  const itemMap = new Map(items?.map((i) => [i.id, i.name]));
  const areaMap = new Map(areas?.map((a) => [a.id, a.name]));

  const lines = lows
    .map(
      (r) =>
        `• ${itemMap.get(r.item_id)} — ${areaMap.get(r.storage_area_id)}: ${r.on_hand} (par ${r.par_level})`
    )
    .join("\n");

  await resend.emails.send({
    from,
    to,
    subject: `LOW STOCK (${lows.length})`,
    text: `The following items are below par:\n\n${lines}`,
  });

  for (const r of lows) {
    await supabase
      .from("storage_inventory")
      .update({ low_notified: true })
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);
  }

  return { ok: true, sent: lows.length };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key === process.env.LOW_STOCK_SECRET) {
    const result = await runEmail();
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: true, route: "/api/notify-low-stock" });
}

export async function POST() {
  const result = await runEmail();
  return NextResponse.json(result);
}
