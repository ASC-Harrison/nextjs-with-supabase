import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type ItemRow = {
  id: string;
  name?: string;
  description?: string;
  on_hand: number | null;
  par_level: number | null;
};

export async function POST() {
  try {
    // Env
    const resendKey = process.env.RESEND_API_KEY!;
    const emailTo = process.env.LOW_STOCK_EMAIL_TO!;
    const emailFrom = process.env.LOW_STOCK_EMAIL_FROM!;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!resendKey || !emailTo || !emailFrom) {
      return Response.json({ ok: false, error: "Missing Resend env vars" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ✅ IMPORTANT: change table/column names here if yours differ
    const TABLE = "items";          // <-- your inventory table name
    const COL_NAME = "name";        // <-- item name column
    const COL_ON_HAND = "on_hand";  // <-- on hand column
    const COL_PAR = "par_level";    // <-- par level column

    // Pull items (we’ll filter in JS to avoid SQL edge cases)
    const { data: items, error: itemsErr } = await supabase
      .from(TABLE)
      .select(`id, ${COL_NAME}, ${COL_ON_HAND}, ${COL_PAR}`);

    if (itemsErr) throw itemsErr;

    const lowNow: ItemRow[] = (items ?? [])
      .map((r: any) => ({
        id: r.id,
        name: r[COL_NAME],
        on_hand: r[COL_ON_HAND],
        par_level: r[COL_PAR],
      }))
      .filter((r) => {
        const onHand = Number(r.on_hand ?? 0);
        const par = Number(r.par_level ?? 0);
        return par > 0 && onHand <= par;
      });

    // Load previous state
    const { data: prevStates, error: prevErr } = await supabase
      .from("low_stock_alert_state")
      .select("item_id,last_is_low");

    if (prevErr) throw prevErr;

    const prevMap = new Map<string, boolean>(
      (prevStates ?? []).map((s: any) => [s.item_id, !!s.last_is_low])
    );

    // Only alert on transitions OK -> LOW
    const newlyLow = lowNow.filter((i) => prevMap.get(i.id) !== true);

    // Upsert current states for ALL items we evaluated
    // Mark low items as true, everything else as false
    const upserts = (items ?? []).map((r: any) => {
      const id = r.id as string;
      const onHand = Number(r[COL_ON_HAND] ?? 0);
      const par = Number(r[COL_PAR] ?? 0);
      const isLow = par > 0 && onHand <= par;
      return { item_id: id, last_is_low: isLow };
    });

    const { error: upsertErr } = await supabase
      .from("low_stock_alert_state")
      .upsert(upserts, { onConflict: "item_id" });

    if (upsertErr) throw upsertErr;

    // If nothing new went low, do nothing
    if (newlyLow.length === 0) {
      return Response.json({ ok: true, message: "No newly-low items. No email sent." });
    }

    // Build email
    const rowsHtml = newlyLow
      .map((i) => {
        const onHand = Number(i.on_hand ?? 0);
        const par = Number(i.par_level ?? 0);
        return `<tr>
          <td style="padding:6px 10px;">${i.name ?? i.id}</td>
          <td style="padding:6px 10px; text-align:right;">${onHand}</td>
          <td style="padding:6px 10px; text-align:right;">${par}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <h2>Low Stock Alert</h2>
      <p>The following items just reached or dropped below par level:</p>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px 10px; text-align:left;">Item</th>
            <th style="padding:6px 10px; text-align:right;">On Hand</th>
            <th style="padding:6px 10px; text-align:right;">Par</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top:12px;">(You’ll only get this email when an item changes from OK → LOW.)</p>
    `;

    const result = await resend.emails.send({
      from: emailFrom,
      to: emailTo,
      subject: `Low Stock Alert (${newlyLow.length})`,
      html,
    });

    // Stamp sent time for items we emailed about
    await supabase
      .from("low_stock_alert_state")
      .upsert(
        newlyLow.map((i) => ({ item_id: i.id, last_is_low: true, last_sent_at: new Date().toISOString() })),
        { onConflict: "item_id" }
      );

    return Response.json({ ok: true, emailed: newlyLow.length, result });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
