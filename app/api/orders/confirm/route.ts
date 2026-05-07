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

    // Show confirmation form with editable quantity
    return new Response(confirmFormPage(order, by), { headers: { "Content-Type": "text/html" } });

  } catch (e: any) {
    return new Response(errorPage(e?.message ?? "Unknown error"), { headers: { "Content-Type": "text/html" } });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get("id") as string;
    const by = formData.get("by") as string || "Brooklyn";
    const status = formData.get("status") as string || "ORDERED";
    const qtyActual = formData.get("qty_actual") as string;
    const qtyReceived = formData.get("qty_received") as string;

    if (!id) return new Response(errorPage("Invalid submission"), { headers: { "Content-Type": "text/html" } });

    const supabase = getServiceClient();

    const { data: order } = await supabase.from("order_requests").select("*").eq("id", id).single();
    if (!order) return new Response(errorPage("Order not found"), { headers: { "Content-Type": "text/html" } });

    const isBackorder = status === "BACKORDERED";

    const update: any = {
      status: isBackorder ? "BACKORDERED" : "ORDERED",
      confirmed_by: by,
      confirmed_at: new Date().toISOString(),
    };

    if (qtyActual && Number(qtyActual) > 0) {
      update.qty_actual_ordered = Number(qtyActual);
    }
    if (qtyReceived && Number(qtyReceived) > 0) {
      update.qty_actual_received = Number(qtyReceived);
    }

    await supabase.from("order_requests").update(update).eq("id", id);

    if (isBackorder) {
      await supabase.from("items").update({ backordered: true, order_status: "BACKORDER" }).eq("name", order.item_name);
    }

    return new Response(successPage(order.item_name, Number(qtyActual) || order.qty_requested, order.unit, by, isBackorder), {
      headers: { "Content-Type": "text/html" },
    });

  } catch (e: any) {
    return new Response(errorPage(e?.message ?? "Unknown error"), { headers: { "Content-Type": "text/html" } });
  }
}

function confirmFormPage(order: any, by: string) {
  const appUrl = "https://nextjs-with-supabase-gamma-rosy.vercel.app";
  return `
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm Order</title></head>
      <body style='font-family:-apple-system,sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box'>
        <div style='max-width:440px;width:100%;background:#162032;border-radius:20px;padding:28px;border:1px solid #1e3a5f;position:relative;overflow:hidden'>
          <div style='position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)'></div>
          <div style='font-size:22px;font-weight:900;color:#f0f6ff;margin-bottom:4px'>⚕️ Baxter ASC</div>
          <div style='font-size:13px;color:#64748b;margin-bottom:20px'>Order Confirmation</div>

          <div style='background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:20px'>
            <div style='font-size:15px;font-weight:800;color:#f0f6ff;margin-bottom:6px'>${order.item_name}</div>
            <div style='font-size:12px;color:#64748b;line-height:1.6'>
              Ref: ${order.reference_number || "—"} · Vendor: ${order.vendor || "—"}<br/>
              Requested qty: <strong style='color:#f0f6ff'>${order.qty_requested} ${order.unit || ""}</strong>
            </div>
          </div>

          <form method='POST' action='${appUrl}/api/orders/confirm'>
            <input type='hidden' name='id' value='${order.id}' />
            <input type='hidden' name='by' value='${by}' />

            <div style='margin-bottom:14px'>
              <label style='font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px'>
                Actual Qty Ordered <span style='color:#64748b;font-weight:400'>(update if different from requested)</span>
              </label>
              <input
                type='number'
                name='qty_actual'
                value='${order.qty_requested}'
                min='1'
                style='width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:12px 14px;font-size:16px;font-weight:800;text-align:center;box-sizing:border-box;outline:none'
              />
              <div style='font-size:11px;color:#334155;margin-top:5px'>Change this if the item only comes in cases or different pack sizes</div>
            </div>

            <div style='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px'>
              <button
                type='submit'
                name='status'
                value='ORDERED'
                style='background:#10b981;color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit'
              >✅ Confirm Ordered</button>
              <button
                type='submit'
                name='status'
                value='BACKORDERED'
                style='background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit'
              >🔴 Backordered</button>
            </div>
          </form>
        </div>
      </body>
    </html>
  `;
}

function successPage(name: string, qty: number, unit: string | null, by: string, isBackorder: boolean) {
  const emoji = isBackorder ? "🔴" : "✅";
  const title = isBackorder ? "Marked as Backordered" : "Order Confirmed!";
  const color = isBackorder ? "#fca5a5" : "#6ee7b7";
  return `
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style='font-family:-apple-system,sans-serif;background:#0a0f1e;color:#f0f6ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box'>
        <div style='max-width:400px;width:100%;background:#162032;border-radius:20px;padding:32px;border:1px solid #1e3a5f;text-align:center;position:relative;overflow:hidden'>
          <div style='position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#10b981,#3b82f6)'></div>
          <div style='font-size:56px;margin-bottom:16px'>${emoji}</div>
          <h2 style='color:${color};margin:0 0 8px;font-size:22px'>${title}</h2>
          <p style='color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px'>
            <strong style='color:#f0f6ff'>${name}</strong> has been updated.
          </p>
          <div style='background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px;font-size:13px;color:${color};margin-bottom:20px'>
            Actual qty ordered: <strong>${qty} ${unit || ""}</strong><br/>
            Confirmed by: ${by}<br/>
            ${new Date().toLocaleString()}
          </div>
          <p style='font-size:12px;color:#334155'>Status updated in the app. You can close this tab.</p>
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
