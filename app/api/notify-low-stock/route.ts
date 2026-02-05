import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function toInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function POST() {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const emailTo = process.env.LOW_STOCK_EMAIL_TO;
    const emailFrom = process.env.LOW_STOCK_EMAIL_FROM;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendKey || !emailTo || !emailFrom) {
      return Response.json({ ok: false, error: "Missing Resend env vars" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Inventory rows + item names
    const { data: invRows, error: invErr } = await supabase
      .from("inventory")
      .select("id, location_id, on_hand, par_level, items(name, barcode)");

    if (invErr) throw invErr;

    const rows = (invRows ?? []).map((r: any) => {
      const onHand = toInt(r.on_hand);
      const par = toInt(r.par_level);
      return {
        inventory_id: r.id as string,
        location_id: String(r.location_id ?? ""),
        on_hand: onHand,
        par_level: par,
        name: r.items?.name ?? "(unknown)",
        barcode: r.items?.barcode ?? "",
        is_low: par > 0 && onHand <= par,
      };
    });

    // Spam prevention state
    await supabase.rpc; // no-op to keep TS happy in some setups

    const { data: states, error: stErr } = await supabase
      .from("low_stock_alert_state")
      .select("inventory_id, last_is_low");

    if (stErr) throw stErr;

    const stateMap = new Map<string, boolean>((states ?? []).map((s: any) => [s.inventory_id, !!s.last_is_low]));

    const newlyLow = rows.filter((r) => r.is_low && stateMap.get(r.inventory_id) !== true);

    // Update state for all rows (low clears when restocked)
    const upserts = rows.map((r) => ({ inventory_id: r.inventory_id, last_is_low: r.is_low }));

    const { error: upErr } = await supabase
      .from("low_stock_alert_state")
      .upsert(upserts, { onConflict: "inventory_id" });

    if (upErr) throw upErr;

    if (newlyLow.length === 0) {
      return Response.json({ ok: true, message: "No newly-low items. No email sent." });
    }

    const htmlRows = newlyLow
      .map(
        (r) => `
        <tr>
          <td style="padding:6px 10px;">${r.location_id}</td>
          <td style="padding:6px 10px;">${r.name}</td>
          <td style="padding:6px 10px;">${r.barcode}</td>
          <td style="padding:6px 10px; text-align:right;">${r.on_hand}</td>
          <td style="padding:6px 10px; text-align:right;">${r.par_level}</td>
        </tr>`
      )
      .join("");

    const html = `
      <h2>ASC Inventory Low Stock Alert</h2>
      <p>These items just dropped to or below par:</p>
      <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px 10px; text-align:left;">Location ID</th>
            <th style="padding:6px 10px; text-align:left;">Item</th>
            <th style="padding:6px 10px; text-align:left;">Barcode</th>
            <th style="padding:6px 10px; text-align:right;">On Hand</th>
            <th style="padding:6px 10px; text-align:right;">Par</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top:10px;">(This only emails on OK → LOW transitions, so it won’t spam you.)</p>
    `;

    const result = await resend.emails.send({
      from: emailFrom,
      to: emailTo,
      subject: `Low Stock Alert (${newlyLow.length})`,
      html,
    });

    // Stamp sent time for newly low
    await supabase
      .from("low_stock_alert_state")
      .upsert(
        newlyLow.map((r) => ({
          inventory_id: r.inventory_id,
          last_is_low: true,
          last_sent_at: new Date().toISOString(),
        })),
        { onConflict: "inventory_id" }
      );

    return Response.json({ ok: true, emailed: newlyLow.length, result });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
