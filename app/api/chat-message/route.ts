import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = ["admin", "staff", "preop"];

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function messagePreview(message: string) {
  return message.length > 140 ? message.slice(0, 137) + "…" : message;
}

async function notifyOtherStaff(
  senderId: string,
  message: { id: string; sender_name: string; message: string }
) {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hogstud800@gmail.com";

  if (!privateKey) {
    console.error("Chat push skipped: VAPID_PRIVATE_KEY is not configured");
    return { sent: 0, failed: 0, configured: false };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id");

  if (error) {
    console.error("Unable to load chat push subscriptions:", error.message);
    return { sent: 0, failed: 0, configured: true };
  }

  const recipients = (subscriptions ?? []).filter(
    subscription => !subscription.user_id || subscription.user_id !== senderId
  );
  const body = JSON.stringify({
    title: "💬 " + message.sender_name,
    body: messagePreview(message.message),
    url: "/chat",
    tag: "chat-" + message.id,
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    recipients.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body
        );
        sent++;
      } catch (error: any) {
        failed++;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
        } else {
          console.error("Chat push send failed:", error?.message ?? error);
        }
      }
    })
  );

  return { sent, failed, configured: true };
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) {
      return NextResponse.json({ ok: false, error: "Staff access required" }, { status: 403 });
    }

    const requestBody = await req.json();
    const cleanMessage =
      typeof requestBody?.message === "string" ? requestBody.message.trim() : "";
    if (!cleanMessage) {
      return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    }
    if (cleanMessage.length > 1000) {
      return NextResponse.json(
        { ok: false, error: "Messages are limited to 1,000 characters" },
        { status: 400 }
      );
    }

    const senderName =
      authData.user.user_metadata?.full_name?.trim() ||
      authData.user.email ||
      "Staff";

    const { data: savedMessage, error: insertError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        sender_id: authData.user.id,
        sender_name: senderName,
        message: cleanMessage,
      })
      .select("id,created_at,sender_id,sender_name,message")
      .single();

    if (insertError) throw insertError;

    // A notification failure must never prevent the chat message from being saved.
    const push = await notifyOtherStaff(authData.user.id, savedMessage);
    return NextResponse.json({ ok: true, message: savedMessage, push });
  } catch (error: any) {
    console.error("Chat message send failed:", error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: "Message failed to send" },
      { status: 500 }
    );
  }
}
