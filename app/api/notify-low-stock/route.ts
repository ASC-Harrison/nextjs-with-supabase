import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function parseToList(raw: string) {
  // allows: "a@x.com,b@y.com" or "a@x.com; b@y.com"
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runEmail() {
  const toRaw = (process.env.LOW_STOCK_EMAIL_TO || "").trim();
  const from = (process.env.LOW_STOCK_EMAIL_FROM || "Inventory Alerts <onboarding@resend.dev>").trim();

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }
  if (!toRaw) {
    return { ok: false, error: "Missing LOW_STOCK_EMAIL_TO" };
  }

  const to = parseToList(toRaw);
  if (to.length === 0) {
    return { ok: false, error: "LOW_STOCK_EMAIL_TO is empty after parsing" };
  }

  // find low + not notified
  const { data: lows, error: lowErr } = await supabase
    .from("storage_inventory")
    .select("storage_area_id, item_id, on_hand, par_level")
    .eq("low", true)
    .eq("low_notified", false);

  if (lowErr) return { ok: false, error: lowErr.message };
  if (!lows || lows.length === 0) {
    return { ok: true, sent: 0, message: "No new low stock items", to, from };
  }

  const itemIds = Array.from(new Set(lows.map((r) => r.item_id)));
  const areaIds = Array.from(new Set(lows.map((r) => r.storage_area_id)));

  const [{ data: items, error: itemsErr }, { data: areas, error: areasErr }] = await Promise.all([
    supabase.from("items").select("id, name, barcode").in("id", itemIds),
    supabase.from("storage_areas").select("id, name").in("id", areaIds),
  ]);

  if (itemsErr) return { ok: false, error: itemsErr.message, to, from };
  if (areasErr) return { ok: false, error: areasErr.message, to, from };

  const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
  const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));

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
    `The following items are below par:\n\n${lines}\n\n` +
    `This alert will not repeat until restocked back to par or above.`;

  // SEND EMAIL — capture result
  const sendResult = await resend.emails.send({
    from,
    to,
    subject,
    text,
  });

  // If Resend returns an error shape, do NOT mark notified
  // (Resend SDK usually throws on error, but we handle both)
  // @ts-ignore
  if (sendResult?.error) {
    // @ts-ignore
    return { ok: false, error: sendResult.error.message ?? "Resend error", to, from };
  }

  // MARK notified only after send succeeds
  for (const r of lows) {
    const { error: updErr } = await supabase
      .from("storage_inventory")
      .update({ low_notified: true })
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);

    if (updErr) {
      // don't fail the whole request; report it
      console.error("Failed to set low_notified:", updErr.message);
    }
  }

  return {
    ok: true,
    sent: lows.length,
    to,
    from,
    // @ts-ignore
    resend_id: sendResult?.data?.id ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  // keep your secret-gated run mode
  if (key && key === process.env.LOW_STOCK_SECRET) {
    const result = await runEmail();
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: true, route: "/api/notify-low-stock" });
}

export async function POST() {
  const result = await runEmail();
  return NextResponse.json(result);
}
