import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ROLES = ["admin", "staff", "preop"];
const BROOKLYN_EMAIL = process.env.BROOKLYN_ORDER_EMAIL || "brooklyncarter.0716@gmail.com";

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
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

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
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

    const body = await req.json().catch(() => null);
    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!orderId) return NextResponse.json({ ok:false, error:"Order is required" }, { status:400 });
    if (!note) return NextResponse.json({ ok:false, error:"Type a note for Brooklyn first" }, { status:400 });
    if (note.length > 500) return NextResponse.json({ ok:false, error:"Follow-up notes are limited to 500 characters" }, { status:400 });

    const { data:order, error:orderError } = await supabaseAdmin
      .from("order_requests")
      .select("id,item_name,reference_number,vendor,qty_requested,qty_actual_ordered,qty_actual_received,status,requested_by,last_follow_up_at,follow_up_count")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ ok:false, error:"Order not found" }, { status:404 });
    if (order.status === "RECEIVED") {
      return NextResponse.json({ ok:false, error:"This item is already marked received" }, { status:409 });
    }

    if (order.last_follow_up_at) {
      const secondsSinceLast = (Date.now() - new Date(order.last_follow_up_at).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return NextResponse.json({ ok:false, error:"A follow-up was just sent for this item. Please wait one minute before sending another." }, { status:429 });
      }
    }

    const senderName =
      (typeof authData.user.user_metadata?.full_name === "string" && authData.user.user_metadata.full_name.trim()) ||
      authData.user.email ||
      "ASC Staff";
    const sentAt = new Date().toISOString();
    const outstanding = Math.max(
      Number(order.qty_actual_ordered || order.qty_requested || 0) - Number(order.qty_actual_received || 0),
      0
    );

    const { error:emailError } = await resend.emails.send({
      from:"Baxter ASC <orders@ascinventory.com>",
      to:[BROOKLYN_EMAIL],
      subject:`Follow-up Needed — ${order.item_name} — Baxter ASC`,
      html:`
        <div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <div style="background:#6d28d9;color:#fff;padding:20px 24px;">
              <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.7px;">Order Follow-up</div>
              <div style="font-size:22px;font-weight:800;margin-top:4px;">${escapeHtml(order.item_name)}</div>
            </div>
            <div style="padding:24px;">
              <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px;font-size:15px;line-height:1.55;">
                ${escapeHtml(note).replaceAll("\n","<br />")}
              </div>
              <table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px;color:#64748b;">Reference #</td><td style="padding:6px;font-weight:700;">${escapeHtml(order.reference_number || "—")}</td></tr>
                <tr><td style="padding:6px;color:#64748b;">Vendor</td><td style="padding:6px;font-weight:700;">${escapeHtml(order.vendor || "—")}</td></tr>
                <tr><td style="padding:6px;color:#64748b;">Status</td><td style="padding:6px;font-weight:700;">${escapeHtml(order.status)}</td></tr>
                <tr><td style="padding:6px;color:#64748b;">Still outstanding</td><td style="padding:6px;font-weight:700;">${outstanding}</td></tr>
                <tr><td style="padding:6px;color:#64748b;">Originally requested by</td><td style="padding:6px;font-weight:700;">${escapeHtml(order.requested_by || "Staff")}</td></tr>
              </table>
              <div style="margin-top:18px;font-size:12px;color:#64748b;">Sent by ${escapeHtml(senderName)} from the Baxter ASC Inventory app.</div>
            </div>
          </div>
        </div>`,
    });
    if (emailError) {
      return NextResponse.json({ ok:false, error:emailError.message }, { status:502 });
    }

    const count = Number(order.follow_up_count || 0) + 1;
    const { error:updateError } = await supabaseAdmin
      .from("order_requests")
      .update({
        last_follow_up_note:note,
        last_follow_up_by:senderName,
        last_follow_up_at:sentAt,
        follow_up_count:count,
      })
      .eq("id", order.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok:true,
      follow_up:{ note, sent_by:senderName, sent_at:sentAt, count },
    });
  } catch (error) {
    return NextResponse.json({
      ok:false,
      error:error instanceof Error ? error.message : "Could not send follow-up",
    }, { status:500 });
  }
}
