import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadInventoryParts() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    return await Promise.all([
      supabaseAdmin
        .from("items")
        .select("id,name,reference_number,vendor,category,par_level,low_level,unit,notes,is_active,order_status,backordered,supply_source,price,expiration_date,alert_note")
        .abortSignal(controller.signal),
      supabaseAdmin
        .from("building_totals")
        .select("item_id,building_on_hand")
        .abortSignal(controller.signal),
      supabaseAdmin
        .from("order_requests")
        .select("id,item_id,created_at,status,qty_requested,qty_actual_ordered,qty_actual_received,requested_by")
        .in("status", ["PENDING","ORDERED","BACKORDERED","AWAITING"])
        .order("created_at", { ascending:false })
        .abortSignal(controller.signal),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const forceFresh = new URL(request.url).searchParams.has("fresh");
  let results: Awaited<ReturnType<typeof loadInventoryParts>> | null = null;
  let lastError = "Inventory load failed";
  let attempts = 0;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    attempts = attempt;
    try {
      const candidate = await loadInventoryParts();
      const error = candidate[0].error ?? candidate[1].error ?? candidate[2].error;
      if (!error) {
        results = candidate;
        break;
      }
      lastError = error.message;
      console.warn("[inventory-sheet-cache] read failed", { attempt, message: lastError });
    } catch (error) {
      lastError = error instanceof Error
        ? (error.name === "AbortError" ? "Inventory read timed out" : error.message)
        : "Inventory read failed";
      console.warn("[inventory-sheet-cache] read failed", { attempt, message: lastError });
    }

    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  if (!results) {
    console.error("[inventory-sheet-cache] unavailable after retry", { attempts, message: lastError });
    return NextResponse.json(
      { error: "Inventory service is temporarily unavailable. Please retry." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "2",
        },
      },
    );
  }

  const [itemsResult, totalsResult, ordersResult] = results;

  const totalsByItem = new Map(
    (totalsResult.data ?? []).map((row) => [row.item_id, Number(row.building_on_hand ?? 0)]),
  );

  const latestOrderByItem = new Map<string, { id:string; date:string; status:string; orderedQty:number; receivedQty:number; requestedBy:string|null }>();
  for (const order of ordersResult.data ?? []) {
    if (order.item_id && !latestOrderByItem.has(order.item_id)) {
      latestOrderByItem.set(order.item_id, {
        id: order.id,
        date: order.created_at,
        status: order.status,
        orderedQty: Number(order.qty_actual_ordered ?? order.qty_requested ?? 0),
        receivedQty: Number(order.qty_actual_received ?? 0),
        requestedBy: order.requested_by ?? null,
      });
    }
  }

  const data = (itemsResult.data ?? [])
    .map((item) => {
      const latestOrder = latestOrderByItem.get(item.id);
      return {
      item_id: item.id,
      name: item.name,
      reference_number: item.reference_number,
      vendor: item.vendor,
      category: item.category,
      total_on_hand: totalsByItem.get(item.id) ?? 0,
      par_level: item.par_level,
      low_level: item.low_level,
      unit: item.unit,
      notes: item.notes,
      is_active: item.is_active,
      backordered: item.backordered,
      supply_source: item.supply_source,
      price: item.price,
      expiration_date: item.expiration_date,
      alert_note: item.alert_note,
      ordered_at: latestOrder?.date ?? null,
      order_status: latestOrder?.status ?? item.order_status,
      open_order_id: latestOrder?.id ?? null,
      open_order_qty: latestOrder?.orderedQty ?? null,
      open_order_received: latestOrder?.receivedQty ?? null,
      open_order_requested_by: latestOrder?.requestedBy ?? null,
    };
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return NextResponse.json(data, {
    headers: forceFresh
      ? { "Cache-Control": "no-store, no-cache, must-revalidate" }
      : {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "Vercel-CDN-Cache-Control": "s-maxage=3, stale-while-revalidate=60, stale-if-error=300",
        },
  });
}
