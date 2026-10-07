import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ROLES = ["admin", "staff", "preop"];
const BROOKLYN_EMAIL = process.env.BROOKLYN_ORDER_EMAIL || "brooklyncarter.0716@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-with-supabase-gamma-rosy.vercel.app";
const SUBJECT = "Pending Orders Reminder";
const NOTE = "Reminder sent to Brooklyn with all items that are still pending and need to be ordered.";

type PendingOrder = {
  id: string;
  created_at: string;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty_requested: number | null;
  requested_by: string | null;
  follow_up_count: number | null;
};

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

function senderName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const fullName = user.user_metadata?.full_name;
  return (typeof fullName === "string" && fullName.trim()) || user.email || "ASC Staff";
}

function orderCard(order: PendingOrder) {
  return `<div style="border:1px solid #fde68a;border-radius:10px;padding:14px;margin-top:12px;background:#fffbeb">
    <div style="font-size:16px;font-weight:800;color:#92400e">${escapeHtml(order.item_name)}</div>
    <table style="width:100%;margin-top:8px;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:4px;color:#64748b">Quantity</td><td style="padding:4px;font-weight:700">${order.qty_requested ?? "—"} ${escapeHtml(order.unit || "")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Reference #</td><td style="padding:4px;font-weight:700">${escapeHtml(order.reference_number || "—")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Vendor</td><td style="padding:4px;font-weight:700">${escapeHtml(order.vendor || "—")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Requested by</td><td style="padding:4px;font-weight:700">${escapeHtml(order.requested_by || "Staff")}</td></tr>
    </table>
  </div>`;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ ok:false, error:"Sign in required" }, { status:401 });

    const { data:authData, error:authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ ok:false, error:"Invalid session" }, { status:401 });

    const { data:roleRow, error:roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return NextResponse.json({ ok:false, error:"Staff access required" }, { status:403 });

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data:recent, error:recentError } = await supabaseAdmin
      .from("brooklyn_messages")
      .select("id")
      .eq("sender_user_id", authData.user.id)
      .eq("subject", SUBJECT)
      .gte("created_at", oneMinuteAgo)
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;
    if (recent) return NextResponse.json({ ok:false, error:"A Pending reminder was just sent. Please wait one minute before sending another." }, { status:429 });

    const { data, error } = await supabaseAdmin
      .from("order_requests")
      .select("id,created_at,item_name,reference_number,vendor,unit,qty_requested,requested_by,follow_up_count")
      .eq("status", "PENDING")
      .order("created_at", { ascending:true });
    if (error) throw error;
    const pending = (data || []) as PendingOrder[];
    if (!pending.length) return NextResponse.json({ ok:false, error:"There are no Pending orders to include" }, { status:409 });

    const sender = senderName(authData.user);
    const sentAt = new Date().toISOString();
    const subject = `Pending Orders Reminder — ${pending.length} item${pending.length === 1 ? "" : "s"} — Baxter ASC`;
    const { data:emailData, error:emailError } = await resend.emails.send({
      from:"Baxter ASC <orders@ascinventory.com>",
      to:[BROOKLYN_EMAIL],
      subject,
      html:`<div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #fde68a;border-radius:14px;overflow:hidden">
          <div style="background:#b45309;color:#fff;padding:20px 24px">
            <div style="font-size:12px;opacity:.88;text-transform:uppercase;letter-spacing:.7px">Pending Order Reminder</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px">${pending.length} item${pending.length === 1 ? "" : "s"} still need to be ordered</div>
          </div>
          <div style="padding:24px">
            <p style="font-size:15px;line-height:1.55;margin:0">Please review the following items that are still in Pending.</p>
            ${pending.map(orderCard).join("")}
            <a href="${APP_URL}/order-history" style="display:inline-block;margin-top:18px;background:#b45309;color:#fff;text-decoration:none;border-radius:9px;padding:11px 16px;font-weight:700">Open Pending Orders</a>
            <div style="margin-top:18px;font-size:12px;color:#64748b">Sent by ${escapeHtml(sender)} from the Baxter ASC Inventory app.</div>
          </div>
        </div>
      </div>`,
    });
    if (emailError) return NextResponse.json({ ok:false, error:emailError.message }, { status:502 });

    const message = [
      `There ${pending.length === 1 ? "is" : "are"} ${pending.length} pending item${pending.length === 1 ? "" : "s"} that still need to be ordered:`,
      "",
      ...pending.map(order => `${order.item_name} — Qty ${order.qty_requested ?? "—"} ${order.unit || ""} — Ref ${order.reference_number || "—"} — ${order.vendor || "No vendor"}`),
    ].join("\n");

    const { error:messageError } = await supabaseAdmin.from("brooklyn_messages").insert({
      sender_user_id:authData.user.id,
      sender_name:sender,
      sender_email:authData.user.email,
      subject:SUBJECT,
      message,
      delivery_status:"SENT",
      provider_message_id:emailData?.id || null,
    });

    const updates = await Promise.all(pending.map(order =>
      supabaseAdmin.from("order_requests").update({
        last_follow_up_note:NOTE,
        last_follow_up_by:sender,
        last_follow_up_at:sentAt,
        follow_up_count:Number(order.follow_up_count || 0) + 1,
      }).eq("id", order.id).eq("status", "PENDING")
    ));
    const updateFailed = updates.some(result => Boolean(result.error));

    return NextResponse.json({
      ok:true,
      email_sent:true,
      count:pending.length,
      follow_up:{ note:NOTE, sent_by:sender, sent_at:sentAt },
      orders:pending.map(order => ({ id:order.id, count:Number(order.follow_up_count || 0) + 1 })),
      warning:messageError || updateFailed ? "The email sent, but part of the in-app reminder history could not be saved." : null,
    });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : "Could not send the Pending reminder" }, { status:500 });
  }
}
