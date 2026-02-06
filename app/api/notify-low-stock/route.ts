import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function parseEmailList(raw?: string | null): string[] {
  if (!raw) return [];
  const s = raw.trim();
  // allow JSON list OR comma-separated
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr)
        ? arr.map(String).map((x) => x.trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export async function POST() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.LOW_STOCK_EMAIL_FROM;
    const to = parseEmailList(process.env.LOW_STOCK_EMAIL_TO);

    if (!apiKey) return Response.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    if (!from) return Response.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_FROM" }, { status: 500 });
    if (to.length === 0) return Response.json({ ok: false, error: "LOW_STOCK_EMAIL_TO is empty/invalid" }, { status: 500 });

    console.log("notify-low-stock to:", to);

    const resend = new Resend(apiKey);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: rows, error } = await supabase
      .from("inventory")
      .select("item_id, location_id, on_hand")
      .eq("low_stock", true)
      .eq("low_stock_notified", false);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return Response.json({ ok: true, message: "No new low stock rows." });
    }

    // Pull item details for nicer email
    const itemIds = rows.map((r) => r.item_id);
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
        ${rows
          .map((r: any) => {
            const it = itemMap.get(r.item_id);
            return `<tr>
              <td>${it?.name ?? r.item_id}</td>
              <td>${it?.barcode ?? ""}</td>
              <td>${r.location_id}</td>
              <td>${r.on_hand}</td>
            </tr>`;
          })
          .join("")}
      </table>
    `;

    // ✅ Send email to multiple recipients
    const sendResult = await resend.emails.send({
      from,
      to, // ✅ ARRAY
      subject: `ASC Low Stock (${rows.length})`,
      html,
    });

    console.log("resend result:", sendResult);

    // Mark notified only after successful send
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
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
