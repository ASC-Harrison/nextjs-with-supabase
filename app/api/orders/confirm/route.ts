import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const by = searchParams.get("by") || "Brooklyn";

    if (!id) {
      return new Response("<html><body style='font-family:sans-serif;padding:40px;text-align:center'><h2>❌ Invalid link</h2></body></html>", {
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabase = getServiceClient();

    const { data: order, error: fetchErr } = await supabase
      .from("order_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return new Response("<html><body style='font-family:sans-serif;padding:40px;text-align:center'><h2>❌ Order not found</h2></body></html>", {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (order.status === "ORDERED" || order.status === "RECEIVED") {
      return new Response(`<html><body style='font-family:sans-serif;padding:40px;text-align:center;background:#0a0f1e;color:#f0f6ff'><div style='max-width:400px;margin:0 auto;background:#162032;border-radius:16px;padding:32px;border:1px solid #1e3a5f'><div style='font-size:48px;margin-bottom:16px'>✅</div><h2 style='color:#6ee7b7'>Already Confirmed</h2><p style='color:#64748b'>${order.item_name} was already marked as ${order.status}.</p></div></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Update status to ORDERED
    const { error: updateErr } = await supabase
      .from("order_requests")
      .update({ status: "ORDERED", confirmed_by: by, confirmed_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Send notification email to admin
    await resend.emails.send({
      from: "Baxter ASC <orders@ascinventory.com>",
      to: ["hogstud800@gmail.com"],
      subject: `✅ Order Confirmed — ${order.item_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;">
          <div style="font-size:36px;margin-bottom:12px">✅</div>
          <h2 style="color:#059669;margin:0 0 16px">Order Confirmed!</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6">
            <strong>${by}</strong> confirmed that the following item has been ordered:
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
            <div style="font-size:16px;font-weight:700;color:#1e293b;">${order.item_name}</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">Ref: ${order.reference_number || "—"} · Vendor: ${order.vendor || "—"}</div>
            <div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:8px;">Qty Ordered: ${order.qty_requested} ${order.unit || ""}</div>
          </div>
          <p style="font-size:12px;color:#94a3b8;">Confirmed at ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    return new Response(`
      <html>
        <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style='font-family:-apple-system,sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box'>
          <div style='max-width:400px;width:100%;background:#162032;border-radius:16px;padding:32px;border:1px solid #1e3a5f;text-align:center;position:relative;overflow:hidden'>
            <div style='position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#10b981,#3b82f6)'></div>
            <div style='font-size:56px;margin-bottom:16px'>✅</div>
            <h2 style='color:#6ee7b7;margin:0 0 8px;font-size:22px'>Order Confirmed!</h2>
            <p style='color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px'><strong style='color:#f0f6ff'>${order.item_name}</strong> has been marked as ordered.</p>
            <div style='background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px;font-size:13px;color:#6ee7b7;margin-bottom:20px'>
              Qty: ${order.qty_requested} ${order.unit || ""}<br/>
              Confirmed by: ${by}<br/>
              ${new Date().toLocaleString()}
            </div>
            <p style='font-size:12px;color:#334155'>The status has been updated in the app. You can close this tab.</p>
          </div>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });

  } catch (e: any) {
    return new Response(`<html><body style='font-family:sans-serif;padding:40px;text-align:center'><h2>❌ Error: ${e?.message}</h2></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }
}
