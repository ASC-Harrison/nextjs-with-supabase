import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const status = searchParams.get("status") || "ORDERED";
    const isBackorder = status === "BACKORDERED";

    if (!id) {
      return new Response(errorPage("Invalid link"), { headers: { "Content-Type": "text/html" } });
    }

    const supabase = getServiceClient();

    const { data: order, error: fetchErr } = await supabase
      .from("order_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return new Response(errorPage("Order not found"), { headers: { "Content-Type": "text/html" } });
    }

    if (order.status === "RECEIVED") {
      return new Response(alreadyDonePage(order.item_name, order.status), { headers: { "Content-Type": "text/html" } });
    }

    // Update status
    const update: any = {
      status: isBackorder ? "BACKORDERED" : "ORDERED",
      confirmed_by: by,
      confirmed_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("order_requests")
      .update(update)
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Also update item backordered status if backordered
    if (isBackorder) {
      await supabase.from("items")
        .update({ backordered: true, order_status: "BACKORDER" })
        .eq("name", order.item_name);
    }

    // Status updated — no email notification needed
    return new Response(successPage(order.item_name, order.qty_requested, order.unit, by, isBackorder), {
      headers: { "Content-Type": "text/html" },
    });

  } catch (e: any) {
    return new Response(errorPage(e?.message ?? "Unknown error"), { headers: { "Content-Type": "text/html" } });
  }
}

function successPage(name: string, qty: number, unit: string | null, by: string, isBackorder: boolean) {
  const emoji = isBackorder ? "🔴" : "✅";
  const title = isBackorder ? "Marked as Backordered" : "Order Confirmed!";
  const color = isBackorder ? "#fca5a5" : "#6ee7b7";
  const bg = isBackorder ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";
  const border = isBackorder ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)";
  const gradColor = isBackorder ? "#ef4444" : "#10b981";

  return `
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style='font-family:-apple-system,sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box'>
        <div style='max-width:400px;width:100%;background:#162032;border-radius:16px;padding:32px;border:1px solid #1e3a5f;text-align:center;position:relative;overflow:hidden'>
          <div style='position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${gradColor},#3b82f6)'></div>
          <div style='font-size:56px;margin-bottom:16px'>${emoji}</div>
          <h2 style='color:${color};margin:0 0 8px;font-size:22px'>${title}</h2>
          <p style='color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px'><strong style='color:#f0f6ff'>${name}</strong> has been updated.</p>
          <div style='background:${bg};border:1px solid ${border};border-radius:10px;padding:14px;font-size:13px;color:${color};margin-bottom:20px'>
            Qty: ${qty} ${unit || ""}<br/>
            Updated by: ${by}<br/>
            ${new Date().toLocaleString()}
          </div>
          ${isBackorder ? '<p style="font-size:12px;color:#fca5a5;font-weight:700;">⚠️ Item status updated to BACKORDERED in the app.</p>' : ''}
          <p style='font-size:12px;color:#334155'>You can close this tab.</p>
        </div>
      </body>
    </html>
  `;
}

function errorPage(msg: string) {
  return `<html><body style='font-family:sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0'><div style='text-align:center;padding:40px'><div style='font-size:48px'>❌</div><h2 style='color:#fca5a5'>${msg}</h2></div></body></html>`;
}

function alreadyDonePage(name: string, status: string) {
  return `<html><body style='font-family:sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0'><div style='text-align:center;padding:40px;background:#162032;border-radius:16px;border:1px solid #1e3a5f;max-width:400px;margin:16px auto'><div style='font-size:48px'>✅</div><h2 style='color:#6ee7b7'>Already ${status}</h2><p style='color:#64748b'>${name} was already marked as ${status}.</p></div></body></html>`;
}
