import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const KAYA_AREA = "Kaya / Case Picking";
const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function errorMessage(error: unknown, fallback = "Unknown error") {
  return error instanceof Error ? error.message : fallback;
}

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

  await Promise.all(((subscriptions ?? []) as PushSubscriptionRow[]).map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, body);
      sent++;
    } catch (error: unknown) {
      failed++;
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Push send failed:", errorMessage(error));
      }
    }
  }));

  return { sent, failed, configured: true };
}

export async function GET(req: Request) {
  try {
    const supabase = getServiceClient();
    let query = supabase
      .from("restock_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (req.headers.get("x-asc-role") === "kaya") {
      query = query.eq("requested_from", KAYA_AREA);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message });

    const itemIds = Array.from(new Set((data ?? []).map((request) => request.item_id).filter(Boolean)));
    const mainOnHandByItem = new Map<string, number>();

    if (itemIds.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from("storage_inventory")
        .select("item_id,on_hand")
        .eq("storage_area_id", MAIN_SUPPLY_ID)
        .in("item_id", itemIds);

      if (inventoryError) {
        return NextResponse.json({ ok: false, error: inventoryError.message });
      }

      for (const row of inventoryRows ?? []) {
        mainOnHandByItem.set(row.item_id, Number(row.on_hand) || 0);
      }
    }

    const enriched = (data ?? []).map((request) => ({
      ...request,
      main_on_hand: request.item_id ? (mainOnHandByItem.get(request.item_id) ?? 0) : null,
    }));

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) });
  }
}

export async function POST(req: Request) {
  try {
    const { item_id, item_name, requested_by, requested_from } = await req.json();
    const role = req.headers.get("x-asc-role");
    const userEmail = req.headers.get("x-asc-user-email");
    if (!item_name || (!requested_by && role !== "kaya")) {
      return NextResponse.json({ ok: false, error: "Missing item_name or requested_by" });
    }

    const supabase = getServiceClient();
    const from = role === "kaya" ? KAYA_AREA : (requested_from || "Pre-Op/PACU");
    const requester = role === "kaya" ? (userEmail || "Kaya") : requested_by;
    const { error } = await supabase.from("restock_requests").insert({
      item_id: item_id || null,
      item_name,
      requested_by: requester,
      requested_from: from,
      status: "PENDING",
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    // A notification failure must never prevent the restock request itself from being saved.
    const push = await sendRestockPush(supabase, { item_name, requested_by: requester, requested_from: from });
    return NextResponse.json({ ok: true, push });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) });
  }
}

const VALID_STATUSES = ["PENDING", "SEEN", "IN_ROUTE", "DELAYED", "RESTOCKED", "OUT_OF_STOCK"];

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

    if (body.take_out_inventory) {
      const id = String(body.id ?? "").trim();
      const qty = Number(body.qty);
      const changedBy = String(body.changed_by ?? "Admin").trim() || "Admin";

      if (!id) {
        return NextResponse.json({ ok: false, error: "Missing request id" }, { status: 400 });
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        return NextResponse.json({ ok: false, error: "Quantity must be a whole number greater than 0" }, { status: 400 });
      }

      const { data: restockRequest, error: requestError } = await supabase
        .from("restock_requests")
        .select("id,item_id,item_name,requested_from")
        .eq("id", id)
        .maybeSingle();

      if (requestError) {
        return NextResponse.json({ ok: false, error: requestError.message }, { status: 400 });
      }
      if (!restockRequest?.item_id) {
        return NextResponse.json({ ok: false, error: "This request is not linked to an inventory item" }, { status: 400 });
      }

      const { data: mainInventory, error: inventoryError } = await supabase
        .from("storage_inventory")
        .select("on_hand")
        .eq("storage_area_id", MAIN_SUPPLY_ID)
        .eq("item_id", restockRequest.item_id)
        .maybeSingle();

      if (inventoryError) {
        return NextResponse.json({ ok: false, error: inventoryError.message }, { status: 400 });
      }

      const available = Number(mainInventory?.on_hand ?? 0);
      if (qty > available) {
        return NextResponse.json(
          { ok: false, error: `Only ${available} available in Main Supply` },
          { status: 409 }
        );
      }

      const { data: transactionData, error: transactionError } = await supabase.rpc("apply_inventory_tx", {
        p_mode: "USE",
        p_target_area: MAIN_SUPPLY_ID,
        p_item: restockRequest.item_id,
        p_qty: qty,
        p_main_area: MAIN_SUPPLY_ID,
      });

      if (transactionError) {
        return NextResponse.json({ ok: false, error: transactionError.message }, { status: 400 });
      }

      const transaction = Array.isArray(transactionData) ? transactionData[0] : transactionData;
      const mainOnHand = Number(transaction?.target_on_hand ?? transaction?.main_on_hand ?? (available - qty));

      const { data: buildingTotal } = await supabase
        .from("building_totals")
        .select("building_on_hand")
        .eq("item_id", restockRequest.item_id)
        .maybeSingle();

      const historyResult = await supabase.from("inventory_history").insert({
        item_id: restockRequest.item_id,
        item_name: restockRequest.item_name,
        on_hand: Number(buildingTotal?.building_on_hand ?? mainOnHand),
        changed_by: changedBy,
        change_type: "USE",
      });

      const auditResult = await supabase.from("audit_log").insert({
        staff: changedBy,
        action: "RESTOCK_REQUEST_TAKE_OUT",
        details: `Qty=${qty} Item=${restockRequest.item_name} From=MAIN SUPPLY Request=${id}`,
        area_name: "MAIN SUPPLY",
      });

      const warnings = [historyResult.error?.message, auditResult.error?.message].filter(Boolean);
      return NextResponse.json({ ok: true, main_on_hand: mainOnHand, warnings });
    }

    const { id, status, resolved_by } = body;
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" });
    const newStatus = VALID_STATUSES.includes(status) ? status : "RESTOCKED";

    const update: Record<string, string> = { status: newStatus };
    if (newStatus === "RESTOCKED" || newStatus === "OUT_OF_STOCK") {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = resolved_by || "Admin";
    }

    const { error } = await supabase.from("restock_requests").update(update).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) });
  }
}
