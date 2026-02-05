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

    const { data: rows } = await supabase
      .from("inventory")
      .select(`
        id,
        location_id,
        on_hand,
        par_level,
        items ( name, barcode )
      `);

    const low = (rows ?? []).filter(
      (r: any) => r.par_level > 0 && r.on_hand <= r.par_level
    );

    if (low.length === 0) {
      return Response.json({ ok: true, message: "No low stock" });
    }

    const html = `
      <h2>Low Stock Alert</h2>
      <table border="1" cellpadding="6">
        <tr>
          <th>Item</th>
          <th>Barcode</th>
          <th>Location ID</th>
          <th>On Hand</th>
          <th>Par</th>
        </tr>
        ${low
          .map(
            (r: any) => `
          <tr>
            <td>${r.items?.name}</td>
            <td>${r.items?.barcode}</td>
            <td>${r.location_id}</td>
            <td>${r.on_hand}</td>
            <td>${r.par_level}</td>
          </tr>
        `
          )
          .join("")}
      </table>
    `;

    await resend.emails.send({
      from: process.env.LOW_STOCK_EMAIL_FROM!,
      to: process.env.LOW_STOCK_EMAIL_TO!,
      subject: `Low Stock Alert (${low.length})`,
      html,
    });

    return Response.json({ ok: true, emailed: low.length });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
