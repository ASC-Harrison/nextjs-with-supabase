import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ROLES = ["admin", "staff", "preop"];
const BROOKLYN_EMAIL = process.env.BROOKLYN_ORDER_EMAIL || "brooklyncarter.0716@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-with-supabase-gamma-rosy.vercel.app";

type IssueOrder = {
  id: string;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty_requested: number | null;
  status: string;
  requested_by: string | null;
  issue_note: string | null;
  issue_reported_by: string | null;
  issue_reported_at: string | null;
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

function staffName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const fullName = user.user_metadata?.full_name;
  return (typeof fullName === "string" && fullName.trim()) || user.email || "ASC Staff";
}

function issueText(order: IssueOrder) {
  return [
    `Item: ${order.item_name}`,
    `Issue: ${order.issue_note || "No details provided"}`,
    `Reference #: ${order.reference_number || "—"}`,
    `Vendor: ${order.vendor || "—"}`,
    `Quantity requested: ${order.qty_requested ?? "—"} ${order.unit || ""}`.trim(),
    `Originally requested by: ${order.requested_by || "Staff"}`,
    `Reported by: ${order.issue_reported_by || "Staff"}`,
  ].join("\n");
}

function issueCard(order: IssueOrder) {
  return `<div style="border:1px solid #fed7aa;border-radius:10px;padding:16px;margin-top:12px;background:#fff7ed">
    <div style="font-size:17px;font-weight:800;color:#9a3412">${escapeHtml(order.item_name)}</div>
    <div style="margin-top:8px;font-size:14px;line-height:1.55"><strong>Issue:</strong> ${escapeHtml(order.issue_note || "No details provided")}</div>
    <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:4px;color:#64748b">Reference #</td><td style="padding:4px;font-weight:700">${escapeHtml(order.reference_number || "—")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Vendor</td><td style="padding:4px;font-weight:700">${escapeHtml(order.vendor || "—")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Quantity requested</td><td style="padding:4px;font-weight:700">${order.qty_requested ?? "—"} ${escapeHtml(order.unit || "")}</td></tr>
      <tr><td style="padding:4px;color:#64748b">Reported by</td><td style="padding:4px;font-weight:700">${escapeHtml(order.issue_reported_by || "Staff")}</td></tr>
    </table>
  </div>`;
}

function emailShell(title: string, body: string) {
  return `<div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #fed7aa;border-radius:14px;overflow:hidden">
      <div style="background:#c2410c;color:#fff;padding:20px 24px">
        <div style="font-size:12px;opacity:.88;text-transform:uppercase;letter-spacing:.7px">Order Issue</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(title)}</div>
      </div>
      <div style="padding:24px">${body}
        <a href="${APP_URL}/order-history" style="display:inline-block;margin-top:18px;background:#c2410c;color:#fff;text-decoration:none;border-radius:9px;padding:11px 16px;font-weight:700">Open the Issues tab</a>
      </div>
    </div>
  </div>`;
}

async function saveMessage(user: { id: string; email?: string | null }, senderName: string, subject: string, message: string, providerMessageId?: string | null) {
  return supabaseAdmin.from("brooklyn_messages").insert({
    sender_user_id:user.id,
    sender_name:senderName,
    sender_email:user.email,
    subject,
    message,
    delivery_status:"SENT",
    provider_message_id:providerMessageId || null,
  });
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

    const body = await request.json().catch(() => null);
    const action = body?.action === "notify_current" ? "notify_current" : "move";
    const sender = staffName(authData.user);

    if (action === "notify_current") {
      const { data, error } = await supabaseAdmin
        .from("order_requests")
        .select("id,item_name,reference_number,vendor,unit,qty_requested,status,requested_by,issue_note,issue_reported_by,issue_reported_at")
        .eq("status", "ISSUE")
        .order("issue_reported_at", { ascending:true });
      if (error) throw error;
      const issues = (data || []) as IssueOrder[];
      if (!issues.length) return NextResponse.json({ ok:true, email_sent:false, count:0 });

      const subject = `Current Issues — ${issues.length} item${issues.length === 1 ? "" : "s"} — Baxter ASC`;
      const message = [`There ${issues.length === 1 ? "is" : "are"} currently ${issues.length} open issue${issues.length === 1 ? "" : "s"}.`, "", ...issues.map(issueText)].join("\n\n");
      const { data:emailData, error:emailError } = await resend.emails.send({
        from:"Baxter ASC <orders@ascinventory.com>",
        to:[BROOKLYN_EMAIL],
        subject,
        html:emailShell(`Current Issues (${issues.length})`, `<p style="font-size:15px;line-height:1.55;margin:0">Here is everything currently in the Issues tab.</p>${issues.map(issueCard).join("")}`),
      });
      if (emailError) return NextResponse.json({ ok:false, error:emailError.message }, { status:502 });
      const { error:messageError } = await saveMessage(authData.user, sender, subject.replace(" — Baxter ASC", ""), message, emailData?.id);

      return NextResponse.json({ ok:true, email_sent:true, count:issues.length, message_saved:!messageError });
    }

    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!orderId) return NextResponse.json({ ok:false, error:"Order is required" }, { status:400 });
    if (!note) return NextResponse.json({ ok:false, error:"Please describe the issue first" }, { status:400 });
    if (note.length > 500) return NextResponse.json({ ok:false, error:"Issue details are limited to 500 characters" }, { status:400 });

    const { data:order, error:orderError } = await supabaseAdmin
      .from("order_requests")
      .select("id,item_name,reference_number,vendor,unit,qty_requested,status,requested_by,issue_note,issue_reported_by,issue_reported_at")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ ok:false, error:"Order not found" }, { status:404 });
    if (order.status === "ISSUE") return NextResponse.json({ ok:false, error:"This order is already in Issues" }, { status:409 });

    const previousStatus = order.status;
    const reportedAt = new Date().toISOString();
    const { data:movedOrder, error:updateError } = await supabaseAdmin
      .from("order_requests")
      .update({
        status:"ISSUE",
        issue_note:note,
        issue_reported_by:sender,
        issue_reported_at:reportedAt,
        issue_previous_status:previousStatus,
      })
      .eq("id", order.id)
      .eq("status", previousStatus)
      .select("id,item_name,reference_number,vendor,unit,qty_requested,status,requested_by,issue_note,issue_reported_by,issue_reported_at,issue_previous_status")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!movedOrder) return NextResponse.json({ ok:false, error:"This order changed. Refresh and try again." }, { status:409 });

    const issue = movedOrder as IssueOrder & { issue_previous_status: string };
    const subject = `New Issue — ${issue.item_name} — Baxter ASC`;
    const { data:emailData, error:emailError } = await resend.emails.send({
      from:"Baxter ASC <orders@ascinventory.com>",
      to:[BROOKLYN_EMAIL],
      subject,
      html:emailShell(issue.item_name, `<p style="font-size:15px;line-height:1.55;margin:0 0 8px">An order was moved into the Issues tab and needs attention.</p>${issueCard(issue)}`),
    });

    if (emailError) {
      await supabaseAdmin.from("order_requests").update({
        status:previousStatus,
        issue_note:null,
        issue_reported_by:null,
        issue_reported_at:null,
        issue_previous_status:null,
      }).eq("id", order.id).eq("status", "ISSUE").eq("issue_reported_at", reportedAt);
      return NextResponse.json({ ok:false, error:`Brooklyn could not be notified, so the item was not moved. ${emailError.message}` }, { status:502 });
    }

    const message = `A new order was moved into Issues.\n\n${issueText(issue)}`;
    const { error:messageError } = await saveMessage(authData.user, sender, subject.replace(" — Baxter ASC", ""), message, emailData?.id);

    return NextResponse.json({ ok:true, order:movedOrder, email_sent:true, message_saved:!messageError });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : "Could not update this issue" }, { status:500 });
  }
}
