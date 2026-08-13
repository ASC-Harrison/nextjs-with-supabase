import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sendRestockPush(supabase: ReturnType<typeof getServiceClient>, payload: { item_name: string; requested_by: string; requested_from: string }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hogstud800@gmail.com";

  if (!privateKey) {
    console.error("Restock push skipped: VAPID_PRIVATE_KEY is not configured");
    return { sent: 0, failed: 0, configured: false };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (error) {
    console.error("Unable to load push subscriptions:", error.message);
    return { sent: 0, failed: 0, configured: true };
  }

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify({
    title: "🔔 Restock Requested",
    body: `${payload.item_name} requested by ${payload.requested_by} from ${payload.requested_from}`,
    url: "/restock-requests",
    tag: `restock-${Date.now()}`,
  });

  await Promise.all((subscriptions ?? []).map(async (sub: any) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, body);
      sent++;
    } catch (e: any) {
      failed++;
      const statusCode = e?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Push send failed:", e?.message ?? e);
      }
    }
  }));

  return { sent, failed, configured: true };
}

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("restock_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}

export async function POST(req: Request) {
  try {
    const { item_id, item_name, requested_by, requested_from } = await req.json();
    if (!item_name || !requested_by) {
      return NextResponse.json({ ok: false, error: "Missing item_name or requested_by" });
    }

    const supabase = getServiceClient();
    const from = requested_from || "Pre-Op/PACU";
    const { error } = await supabase.from("restock_requests").insert({
      item_id: item_id || null,
      item_name,
      requested_by,
      requested_from: from,
      status: "PENDING",
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    // A notification failure must never prevent the restock request itself from being saved.
    const push = await sendRestockPush(supabase, { item_name, requested_by, requested_from: from });
    return NextResponse.json({ ok: true, push });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}

const VALID_STATUSES = ["PENDING", "SEEN", "IN_ROUTE", "RESTOCKED", "OUT_OF_STOCK"];

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceClient();

    if (body.mark_all_seen) {
      const { error } = await supabase
        .from("restock_requests")
        .update({ status: "SEEN" })
        .eq("status", "PENDING");
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    const { id, status, resolved_by } = body;
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" });
    const newStatus = VALID_STATUSES.includes(status) ? status : "RESTOCKED";

    const update: Record<string, any> = { status: newStatus };
    if (newStatus === "RESTOCKED" || newStatus === "OUT_OF_STOCK") {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = resolved_by || "Admin";
    }

    const { error } = await supabase.from("restock_requests").update(update).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
