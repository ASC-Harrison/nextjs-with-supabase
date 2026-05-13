import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type OrderItem = {
  name: string;
  item_id: string | null;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty: number;
};

const APP_URL = "https://nextjs-with-supabase-gamma-rosy.vercel.app";

export async function POST(req: Request) {
  try {
    const { items, requested_by } = await req.json() as { items: OrderItem[]; requested_by: string };

    if (!items || items.length === 0) {
      return NextResponse.json({ ok: false, error: "No items provided" });
    }

    const supabase = getServiceClient();

    // Save each item to order_requests table
    const orderRows = items.map(item => ({
      requested_by: requested_by || "Staff",
      item_name: item.name,
      item_id: item.item_id || null,
      reference_number: item.reference_number || null,
      vendor: item.vendor || null,
      unit: item.unit || null,
      qty_requested: item.qty,
      status: "PENDING",
    }));

    const { data: savedOrders, error: saveError } = await supabase
      .from("order_requests")
      .insert(orderRows)
      .select();

    if (saveError) {
      return NextResponse.json({ ok: false, error: saveError.message });
    }

    const now = new Date().toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    // Build confirm buttons for each item
    const rows = items.map((item, i) => {
      const orderId = savedOrders?.[i]?.id ?? "";
      const confirmUrl = `${APP_URL}/api/orders/confirm?id=${orderId}&by=Brooklyn`;
      const backorderUrl = `${APP_URL}/api/orders/confirm?id=${orderId}&by=Brooklyn&status=BACKORDERED`;
      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:12px 14px;font-size:14px;color:#1e293b;font-weight:600;">${item.name}</td>
          <td style="padding:12px 14px;font-size:13px;color:#475569;">${item.reference_number || "—"}</td>
          <td style="padding:12px 14px;font-size:13px;color:#475569;">${item.vendor || "—"}</td>
          <td style="padding:12px 14px;font-size:13px;color:#475569;text-align:center;">${item.unit || "—"}</td>
          <td style="padding:12px 14px;font-size:14px;color:#2563eb;font-weight:800;text-align:center;">${item.qty}</td>
          <td style="padding:12px 14px;text-align:center;">
            <a href="${confirmUrl}" style="background:#10b981;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;display:inline-block;margin-bottom:6px;">✅ Ordered</a><br/>
            <a href="${backorderUrl}" style="background:#ef4444;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;display:inline-block;">🔴 Backordered</a>
          </td>
        </tr>
      `;
    }).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;border-radius:12px 12px 0 0;">
          <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">⚕️ Baxter ASC</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Supply Order Request</div>
        </div>
        <div style="padding:28px 32px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Item</th>
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Ref #</th>
                <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Vendor</th>
                <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Unit</th>
                <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Qty</th>
                <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Confirm</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:20px;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">
            ⚡ Click <strong>"Confirm Ordered"</strong> next to each item once you've placed the order. This will update the status in the app automatically.
          </div>
          <div style="margin-top:16px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
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
      to: ["hogstud800@gmail.com", "brooklyncarter.0716@gmail.com", "andrea.burris88@icloud.com", "Ashcpaine@gmail.com"],
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
