import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "staff", "preop"];
const CLOSED_STATUSES = new Set(["RECEIVED", "CANCELLED", "CANCELED", "COMPLETED"]);

type InventoryRow = {
  item_id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  order_status?: string | null;
  backordered?: boolean | null;
};

type ItemMeta = {
  id: string;
  price: number | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  item_id: string | null;
  item_name: string;
  status: string;
  qty_requested: number | null;
  qty_actual_ordered: number | null;
  qty_actual_received: number | null;
  vendor: string | null;
  expected_delivery_date: string | null;
};

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function normalizedStatus(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

export async function GET(req: Request) {
  try {
    const token = bearerToken(req);
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

    const [inventoryResult, itemResult, orderResult] = await Promise.all([
      supabaseAdmin
        .from("building_inventory_sheet_view")
        .select("item_id,name,reference_number,vendor,total_on_hand,par_level,low_level,unit,order_status,backordered")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("items")
        .select("id,price")
        .eq("is_active", true),
      supabaseAdmin
        .from("order_requests")
        .select("id,created_at,item_id,item_name,status,qty_requested,qty_actual_ordered,qty_actual_received,vendor,expected_delivery_date")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (inventoryResult.error) throw inventoryResult.error;
    if (itemResult.error) throw itemResult.error;
    if (orderResult.error) throw orderResult.error;

    const inventory = (inventoryResult.data || []) as InventoryRow[];
    const itemMeta = (itemResult.data || []) as ItemMeta[];
    const orders = (orderResult.data || []) as OrderRow[];
    const priceById = new Map(itemMeta.map(item => [item.id, item.price]));

    const attention = inventory
      .filter(row => {
        const lowLevel = Number(row.low_level ?? 0);
        return lowLevel > 0 && Number(row.total_on_hand ?? 0) <= lowLevel;
      })
      .map(row => {
        const onHand = Number(row.total_on_hand ?? 0);
        const par = Number(row.par_level ?? 0);
        const low = Number(row.low_level ?? 0);
        const price = priceById.get(row.item_id) ?? null;
        const shortage = Math.max(par - onHand, 0);
        return {
          id: row.item_id,
          name: row.name,
          reference: row.reference_number,
          vendor: row.vendor,
          on_hand: onHand,
          par,
          low,
          unit: row.unit,
          status: onHand <= 0 ? "OUT" : "LOW",
          backordered: Boolean(row.backordered) || normalizedStatus(row.order_status) === "BACKORDERED",
          estimated_restock_cost: price !== null ? Number(price) * shortage : null,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "OUT" ? -1 : 1;
        if (a.backordered !== b.backordered) return a.backordered ? -1 : 1;
        return (a.on_hand - a.low) - (b.on_hand - b.low);
      });

    const openOrders = orders.filter(order => !CLOSED_STATUSES.has(normalizedStatus(order.status)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueOrders = openOrders
      .filter(order => {
        if (!order.expected_delivery_date) return false;
        const expected = new Date(order.expected_delivery_date + "T00:00:00");
        return !Number.isNaN(expected.getTime()) && expected < today;
      })
      .map(order => ({
        id: order.id,
        item: order.item_name,
        status: normalizedStatus(order.status) || "OPEN",
        expected: order.expected_delivery_date,
        vendor: order.vendor,
        requested: order.qty_requested,
        ordered: order.qty_actual_ordered,
        received: order.qty_actual_received,
      }));

    const missingPriceItems = inventory
      .filter(row => {
        const price = priceById.get(row.item_id);
        return price === null || price === undefined || Number(price) <= 0;
      })
      .map(row => ({ id: row.item_id, name: row.name, reference: row.reference_number }))
      .slice(0, 12);

    const backorderedCount = openOrders.filter(order => normalizedStatus(order.status) === "BACKORDERED").length;
    const estimatedRestockCost = attention.reduce(
      (sum, item) => sum + (item.estimated_restock_cost ?? 0),
      0
    );

    return NextResponse.json(
      {
        ok: true,
        generated_at: new Date().toISOString(),
        metrics: {
          active_items: inventory.length,
          needs_attention: attention.length,
          out_of_stock: attention.filter(item => item.status === "OUT").length,
          open_orders: openOrders.length,
          overdue_orders: overdueOrders.length,
          backordered_orders: backorderedCount,
          missing_prices: inventory.filter(row => {
            const price = priceById.get(row.item_id);
            return price === null || price === undefined || Number(price) <= 0;
          }).length,
          estimated_restock_cost: estimatedRestockCost,
        },
        priorities: attention.slice(0, 10),
        overdue_orders: overdueOrders.slice(0, 10),
        missing_price_items: missingPriceItems,
        safety: "Read-only operations analysis. No inventory, order, price, or status was changed.",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("AI operations summary failed:", error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: "The operations briefing could not be loaded safely." },
      { status: 500 }
    );
  }
}
