import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function parseRecipients(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST() {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.LOW_STOCK_EMAIL_FROM;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;
    const to = parseRecipients(toRaw);

    if (!resendKey) return Response.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    if (!from) return Response.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_FROM" }, { status: 500 });
    if (to.length === 0) return Response.json({ ok: false, error: "LOW_STOCK_EMAIL_TO is empty" }, { status: 500 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return Response.json({ ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
    if (!serviceKey) return Response.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    const resend = new Resend(resendKey);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Pull rows that are low and NOT notified yet
    const { data: rows, error } = await supabase
      .from("inventory")
      .select("item_id, location_id, on_hand")
      .eq("low_stock", true)
      .eq("low_stock_notified", false);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return Response.json({ ok: true, message: "No new low stock rows.", to });
    }

    const itemIds = rows.map((r: any) => r.item_id);
    const { data: items, error: itemsErr } = await supabase
      .from("items")
      .select("id, name, barcode")
      .in("id", itemIds);

    if (itemsErr) throw itemsErr;

    const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));

    const html = `
      <h2>Low Stock Alert</h2>
      <p>${rows.length} item(s) are low:</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <tr><th>Item</th><th>Barcode</th><th>Location</th><th>On Hand</th></tr>
        ${rows.map((r: any) => {
          const it = itemMap.get(r.item_id);
          return `<tr>
            <td>${it?.name ?? r.item_id}</td>
            <td>${it?.barcode ?? ""}</td>
            <td>${r.location_id}</td>
            <td>${r.on_hand}</td>
          </tr>`;
        }).join("")}
      </table>
    `;

    console.log("LOW STOCK EMAIL → from:", from, "to:", to, "count:", rows.length);
const recipients = (process.env.LOW_STOCK_EMAIL_TO || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

    const sendResult = await resend.emails.send({
  from: process.env.LOW_STOCK_EMAIL_FROM!,
  to: recipients,
  subject: `ASC Low Stock (${rows.length})`,
  html,
});


    console.log("Resend send result:", sendResult);

    // @ts-ignore
    if (sendResult?.error) {
      // @ts-ignore
      return Response.json({ ok: false, resend_error: sendResult.error, to }, { status: 500 });
    }

    // Mark notified only AFTER successful send
    for (const r of rows) {
      const { error: updErr } = await supabase
        .from("inventory")
        .update({ low_stock_notified: true })
        .eq("item_id", r.item_id)
        .eq("location_id", r.location_id);

      if (updErr) throw updErr;
    }

    return Response.json({ ok: true, emailed: rows.length, to });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
