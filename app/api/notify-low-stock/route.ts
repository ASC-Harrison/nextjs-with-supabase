import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const resend = new Resend(process.env.RESEND_API_KEY!);

    // 1) Find rows that are low AND not notified yet
    const { data: lowRows, error } = await supabase
      .from("inventory")
      .select("item_id, location_id, on_hand, product_id")
      .eq("low_stock", true)
      .eq("low_stock_notified", false);

    if (error) throw error;

    if (!lowRows || lowRows.length === 0) {
      return Response.json({ ok: true, message: "No new low stock." });
    }

    // Optional: pull item names/barcodes for the email
    const itemIds = lowRows.map(r => r.item_id);
    const { data: items } = await supabase
      .from("items")
      .select("id, name, barcode")
      .in("id", itemIds);

    const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));

    const html = `
      <h2>Low Stock Alert</h2>
      <p>These items are low:</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <tr>
          <th>Item</th><th>Barcode</th><th>Location ID</th><th>On Hand</th>
        </tr>
        ${lowRows.map((r: any) => {
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

    await resend.emails.send({
      from: process.env.LOW_STOCK_EMAIL_FROM!,
      to: process.env.LOW_STOCK_EMAIL_TO!,
      subject: `Low Stock Alert (${lowRows.length})`,
      html,
    });

    // 2) Mark them notified (update by composite key)
    for (const r of lowRows) {
      await supabase
        .from("inventory")
        .update({ low_stock_notified: true })
        .eq("item_id", r.item_id)
        .eq("location_id", r.location_id);
    }

    return Response.json({ ok: true, emailed: lowRows.length });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
