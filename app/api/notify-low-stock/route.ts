import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);

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
    const { data: items } = await supabase
      .from("items")
      .select("id, name, barcode")
      .in("id", itemIds);

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
      <p style="margin-top:12px;color:#666;font-size:12px">
        Note: location shown is the UUID. We can replace that with the location name if you want.
      </p>
    `;

    await resend.emails.send({
      from: process.env.LOW_STOCK_EMAIL_FROM!,
      to: process.env.LOW_STOCK_EMAIL_TO!,
      subject: `ASC Low Stock (${rows.length})`,
      html,
    });

    // Mark notified (composite key update)
    for (const r of rows) {
      await supabase
        .from("inventory")
        .update({ low_stock_notified: true })
        .eq("item_id", r.item_id)
        .eq("location_id", r.location_id);
    }

    return Response.json({ ok: true, emailed: rows.length });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
