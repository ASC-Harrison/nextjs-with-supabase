import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type OrderItem = {
  name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty: number;
};

export async function POST(req: Request) {
  try {
    const { items, requested_by } = await req.json() as { items: OrderItem[]; requested_by: string };

    if (!items || items.length === 0) {
      return NextResponse.json({ ok: false, error: "No items provided" });
    }

    const now = new Date().toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const rows = items.map((item) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 14px;font-size:14px;color:#1e293b;font-weight:600;">${item.name}</td>
        <td style="padding:12px 14px;font-size:13px;color:#475569;">${item.reference_number || "—"}</td>
        <td style="padding:12px 14px;font-size:13px;color:#475569;">${item.vendor || "—"}</td>
        <td style="padding:12px 14px;font-size:13px;color:#475569;text-align:center;">${item.unit || "—"}</td>
        <td style="padding:12px 14px;font-size:14px;color:#2563eb;font-weight:800;text-align:center;">${item.qty}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;border-radius:12px 12px 0 0;">
          <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">⚕️ Baxter ASC</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Supply Order Request</div>
        </div>
        <div style="padding:28px 32px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Ref #</th>
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Vendor</th>
                <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Unit</th>
                <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Qty to Order</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:24px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
            <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Requested by</div>
            <div style="font-size:15px;font-weight:700;color:#1e293b;">${requested_by}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${now}</div>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;">
          Sent from Baxter ASC Inventory System
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Baxter ASC <orders@ascinventory.com>",
      to: ["hogstud800@gmail.com", "brooklyncarter.0716@gmail.com", "andrea.burris88@icloud.com"],
      subject: `Supply Order Request — ${items.length} item${items.length > 1 ? "s" : ""} — Baxter ASC`,
      html,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
