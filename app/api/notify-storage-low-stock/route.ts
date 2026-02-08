import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type LowRow = {
  storage_area_id: string;
  item_id: string;
  item_name: string | null;
  cabinet_name: string | null;
  on_hand: number;
  par_level: number;
  low: boolean;
  low_notified: boolean | null;
};

function parseRecipients(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runLowStockJob() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const toRaw = process.env.LOW_STOCK_EMAIL_TO;
  const from =
    process.env.LOW_STOCK_EMAIL_FROM ??
    "Inventory Alerts <onboarding@resend.dev>";

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!resendApiKey || !toRaw || !supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, body: { error: "Missing environment variables" } };
  }

  const recipients = parseRecipients(toRaw);
  if (recipients.length === 0) {
    return { ok: false, status: 500, body: { error: "LOW_STOCK_EMAIL_TO is empty" } };
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // READ from view (computed low)
  const { data, error } = await supabase
    .from("storage_inventory_named")
    .select(
      `
      storage_area_id,
      item_id,
      item_name,
      cabinet_name,
      on_hand,
      par_level,
      low,
      low_notified
    `
    )
    .eq("low", true)
    .or("low_notified.is.null,low_notified.eq.false");

  if (error) {
    return { ok: false, status: 500, body: { error: error.message } };
  }

  const rows = (data ?? []) as LowRow[];

  if (rows.length === 0) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, sent: false, reason: "No new low items" },
    };
  }

  // Group by cabinet/location
  const byCabinet = new Map<string, LowRow[]>();
  for (const r of rows) {
    const cabinet = (r.cabinet_name ?? "Unknown Location").trim();
    if (!byCabinet.has(cabinet)) byCabinet.set(cabinet, []);
    byCabinet.get(cabinet)!.push(r);
  }

  const emailedPairs: { storage_area_id: string; item_id: string }[] = [];

  // Send one email per cabinet
  for (const [cabinet, items] of byCabinet.entries()) {
    items.sort((a, b) => (a.item_name ?? "").localeCompare(b.item_name ?? ""));

    const subject = `LOW STOCK: ${cabinet} (${items.length} item${items.length === 1 ? "" : "s"})`;
    const text =
      `Low stock alert for ${cabinet}\n\n` +
      items
        .map(
          (i) =>
            `• ${(i.item_name ?? i.item_id)} — On hand: ${i.on_hand} / Par: ${i.par_level}`
        )
        .join("\n");

    const send = await resend.emails.send({
      from,
      to: recipients,
      subject,
      text,
    });

    if ((send as any)?.error) {
      return { ok: false, status: 500, body: { error: (send as any).error } };
    }

    for (const i of items) {
      emailedPairs.push({ storage_area_id: i.storage_area_id, item_id: i.item_id });
    }
  }

  // IMPORTANT: update the BASE table (not the view)
  for (const p of emailedPairs) {
    const { error: updErr } = await supabase
      .from("storage_inventory")
      .update({ low_notified: true })
      .eq("storage_area_id", p.storage_area_id)
      .eq("item_id", p.item_id);

    if (updErr) {
      return { ok: false, status: 500, body: { error: `Update error: ${updErr.message}` } };
    }
  }

  return {
    ok: true,
    status: 200,
    body: { ok: true, sent: true, rowsNotified: emailedPairs.length },
  };
}

// ✅ Cron jobs call GET
export async function GET() {
  const result = await runLowStockJob();
  return NextResponse.json(result.body, { status: result.status });
}

// ✅ Your phone shortcut / Postman can keep using POST
export async function POST() {
  const result = await runLowStockJob();
  return NextResponse.json(result.body, { status: result.status });
}
