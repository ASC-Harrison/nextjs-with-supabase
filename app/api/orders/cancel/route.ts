import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ROLES = ["admin", "staff", "preop"];
const BROOKLYN_EMAIL = process.env.BROOKLYN_ORDER_EMAIL || "brooklyncarter.0716@gmail.com";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ ok:false, error:"Sign in required" }, { status:401 });

    const { data:authData, error:authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ ok:false, error:"Invalid session" }, { status:401 });
    }

    const { data:roleRow, error:roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return NextResponse.json({ ok:false, error:"Staff access required" }, { status:403 });

    const body = await request.json().catch(() => null);
    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    if (!orderId) return NextResponse.json({ ok:false, error:"Order is required" }, { status:400 });

    const { data:order, error:orderError } = await supabaseAdmin
      .from("order_requests")
      .select("id,item_name,reference_number,vendor,unit,qty_requested,status,requested_by,notes")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ ok:false, error:"Order not found" }, { status:404 });
    if (order.status !== "PENDING") {
      return NextResponse.json({ ok:false, error:"Only pending orders can be canceled" }, { status:409 });
    }

    const cancelledAt = new Date().toISOString();
    const cancelledBy =
      (typeof authData.user.user_metadata?.full_name === "string" && authData.user.user_metadata.full_name.trim()) ||
      authData.user.email ||
      "ASC Staff";
    const cancellationReason = "Ordered by mistake — please disregard.";

    const { data:cancelledOrder, error:cancelError } = await supabaseAdmin
      .from("order_requests")
      .update({
        status:"CANCELLED",
        cancelled_at:cancelledAt,
        cancelled_by:cancelledBy,
        cancellation_reason:cancellationReason,
        cancellation_email_status:"SENDING",
      })
      .eq("id", order.id)
      .eq("status", "PENDING")
      .select("id,status,cancelled_at,cancelled_by,cancellation_reason")
      .maybeSingle();
    if (cancelError) throw cancelError;
    if (!cancelledOrder) {
      return NextResponse.json({ ok:false, error:"This order is no longer pending. Refresh and try again." }, { status:409 });
    }

    const subject = `ORDER CANCELED — ${order.item_name} — Baxter ASC`;
    const message = [
      "Order canceled — please disregard.",
      "",
      `Item: ${order.item_name}`,
      `Reference #: ${order.reference_number || "—"}`,
      `Vendor: ${order.vendor || "—"}`,
      `Quantity: ${order.qty_requested} ${order.unit || ""}`.trim(),
      `Originally requested by: ${order.requested_by || "Staff"}`,
      `Canceled by: ${cancelledBy}`,
    ].join("\n");

    const { data:emailData, error:emailError } = await resend.emails.send({
      from:"Baxter ASC <orders@ascinventory.com>",
      to:[BROOKLYN_EMAIL],
      subject,
      html:`
        <div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #fecaca;border-radius:14px;overflow:hidden">
            <div style="background:#b91c1c;color:#fff;padding:20px 24px">
              <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.7px">Order Cancellation</div>
              <div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(order.item_name)}</div>
            </div>
            <div style="padding:24px">
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;font-size:17px;font-weight:800;color:#991b1b">
                Order canceled — please disregard.
              </div>
              <table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:6px;color:#64748b">Reference #</td><td style="padding:6px;font-weight:700">${escapeHtml(order.reference_number || "—")}</td></tr>
                <tr><td style="padding:6px;color:#64748b">Vendor</td><td style="padding:6px;font-weight:700">${escapeHtml(order.vendor || "—")}</td></tr>
                <tr><td style="padding:6px;color:#64748b">Quantity</td><td style="padding:6px;font-weight:700">${order.qty_requested} ${escapeHtml(order.unit || "")}</td></tr>
                <tr><td style="padding:6px;color:#64748b">Originally requested by</td><td style="padding:6px;font-weight:700">${escapeHtml(order.requested_by || "Staff")}</td></tr>
                <tr><td style="padding:6px;color:#64748b">Canceled by</td><td style="padding:6px;font-weight:700">${escapeHtml(cancelledBy)}</td></tr>
              </table>
            </div>
          </div>
        </div>`,
    });

    const emailSent = !emailError;
    await supabaseAdmin
      .from("order_requests")
      .update({
        cancellation_email_status:emailSent ? "SENT" : "FAILED",
        cancellation_email_id:emailData?.id || null,
      })
      .eq("id", order.id);

    const { error:messageError } = await supabaseAdmin.from("brooklyn_messages").insert({
      sender_user_id:authData.user.id,
      sender_name:cancelledBy,
      sender_email:authData.user.email,
      subject,
      message,
      delivery_status:emailSent ? "SENT" : "FAILED",
      provider_message_id:emailData?.id || null,
    });

    return NextResponse.json({
      ok:true,
      order:cancelledOrder,
      email_sent:emailSent,
      message_saved:!messageError,
      warning:emailError?.message || (messageError ? "The cancellation email sent, but its in-app copy could not be saved." : null),
    });
  } catch (error) {
    return NextResponse.json({
      ok:false,
      error:error instanceof Error ? error.message : "Could not cancel this order",
    }, { status:500 });
  }
}
