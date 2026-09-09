import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);
const BROOKLYN_EMAIL = (process.env.BROOKLYN_ORDER_EMAIL || "brooklyncarter.0716@gmail.com").toLowerCase();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-with-supabase-gamma-rosyामुळे.vercel.app";
const ALLOWED_ROLES = ["admin", "staff", "preop"];
const MESSAGE_FIELDS = "id,created_at,sender_name,subject,message,delivery_status,read_at,read_by,response,responded_at,responded_by";

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function authorizedUser(request: Request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: role } = await supabaseAdmin.from("app_user_roles").select("role").eq("user_id", data.user.id).in("role", ALLOWED_ROLES).limit(1).maybeSingle();
  return role ? data.user : null;
}

function isBrooklyn(email?: string | null) {
  return (email || "").toLowerCase() === BROOKLYN_EMAIL;
}

export async function GET(request: Request) {
  const user = await authorizedUser(request);
  if (!user) return NextResponse.json({ ok:false, error:"Staff access required" }, { status:403 });

  const brooklyn = isBrooklyn(user.email);
  if (brooklyn) {
    const readAt = new Date().toISOString();
    const reader = (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) || "Brooklyn";
    const { error:readError } = await supabaseAdmin.from("brooklyn_messages").update({ read_at:readAt, read_by:reader }).is("read_at", null);
    if (readError) return NextResponse.json({ ok:false, error:readError.message }, { status:500 });
  }

  const { data, error } = await supabaseAdmin.from("brooklyn_messages").select(MESSAGE_FIELDS).order("created_at", { ascending:false }).limit(50);
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, messages:data ?? [], is_brooklyn:brooklyn });
}

export async function POST(request: Request) {
  try {
    const user = await authorizedUser(request);
    if (!user) return NextResponse.json({ ok:false, error:"Staff access required" }, { status:403 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!subject || !message) return NextResponse.json({ ok:false, error:"Add a subject and message" }, { status:400 });
    if (subject.length > 120 || message.length > 2000) return NextResponse.json({ ok:false, error:"Subject or message is too long" }, { status:400 });

    const { data:recent } = await supabaseAdmin.from("brooklyn_messages").select("created_at").eq("sender_user_id", user.id).order("created_at", { ascending:false }).limit(1).maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 30000) {
      return NextResponse.json({ ok:false, error:"Please wait 30 seconds before sending another note." }, { status:429 });
    }

    const senderName = (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) || user.email || "ASC Staff";
    const { data:emailData, error:emailError } = await resend.emails.send({
      from:"Baxter ASC <orders@ascinventory.com>",
      to:[BROOKLYN_EMAIL],
      subject:`${subject} — Baxter ASC`,
      html:`<div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><div style="background:#1d4ed8;color:#fff;padding:20px 24px"><div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.7px">Direct note for Brooklyn</div><div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(subject)}</div></div><div style="padding:24px"><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;font-size:15px;line-height:1.6">${escapeHtml(message).replaceAll("\n","<br />")}</div><a href="${APP_URL}/message-brooklyn" style="display:inline-block;margin-top:18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:9px;padding:11px 16px;font-weight:700">Open, read, and reply in the app</a><div style="margin-top:18px;font-size:12px;color:#64748b">Sent by ${escapeHtml(senderName)} from the Baxter ASC Inventory app.</div></div></div></div>`,
    });
    if (emailError) return NextResponse.json({ ok:false, error:emailError.message }, { status:502 });

    const { data:saved, error:saveError } = await supabaseAdmin.from("brooklyn_messages").insert({
      sender_user_id:user.id, sender_name:senderName, sender_email:user.email, subject, message,
      delivery_status:"SENT", provider_message_id:emailData?.id || null,
    }).select(MESSAGE_FIELDS).single();
    if (saveError) throw saveError;
    return NextResponse.json({ ok:true, message:saved });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : "Could not send note" }, { status:500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authorizedUser(request);
    if (!user) return NextResponse.json({ ok:false, error:"Staff access required" }, { status:403 });
    if (!isBrooklyn(user.email)) return NextResponse.json({ ok:false, error:"Only Brooklyn can reply to these notes" }, { status:403 });

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const response = typeof body?.response === "string" ? body.response.trim() : "";
    if (!id || !response) return NextResponse.json({ ok:false, error:"Type a response first" }, { status:400 });
    if (response.length > 2000) return NextResponse.json({ ok:false, error:"Responses are limited to 2,000 characters" }, { status:400 });

    const responder = (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) || "Brooklyn";
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from("brooklyn_messages").update({
      read_at:now, read_by:responder, response, responded_at:now, responded_by:responder,
    }).eq("id", id).select(MESSAGE_FIELDS).single();
    if (error) throw error;
    return NextResponse.json({ ok:true, message:data });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : "Could not save reply" }, { status:500 });
  }
}
