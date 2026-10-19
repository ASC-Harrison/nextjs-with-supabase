import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildReorderPlan, type ReorderItem, type ReorderMeta, type ReorderOrder } from "@/lib/reorder-plan";

// Explicit pagination prevents silently excluding items after the API row limit.
async function allPages<T>(page: (from: number, to: number) => PromiseLike<{data: unknown; error: {message: string} | null}>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    const batch = result.data as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export async function loadReorderPlan() {
  const [items, orders, metadata] = await Promise.all([
    allPages<ReorderItem>((from, to) => supabaseAdmin.from("building_inventory_sheet_view").select("item_id,name,reference_number,vendor,total_on_hand,par_level,low_level,unit,backordered").eq("is_active", true).order("item_id").range(from, to)),
    allPages<ReorderOrder>((from, to) => supabaseAdmin.from("order_requests").select("item_id,reference_number,status,unit,qty_requested,qty_actual_ordered,qty_actual_received").not("status", "in", "(RECEIVED,CANCELLED,CANCELED,COMPLETED)").order("id").range(from, to)),
    allPages<ReorderMeta>((from, to) => supabaseAdmin.from("items").select("id,price,units_per_box").eq("is_active", true).order("id").range(from, to)),
  ]);
  const rows = buildReorderPlan(items, orders, metadata);
  return {
    generated_at: new Date().toISOString(), rows,
    summary: {
      active_items: rows.length,
      out_of_stock: rows.filter(row => row.status === "OUT OF STOCK").length,
      needs_reorder: rows.filter(row => (row.suggested_quantity ?? 0) > 0).length,
      existing_requests: rows.filter(row => row.open_orders > 0).length,
      missing_targets: rows.filter(row => row.par <= 0).length,
    },
    automation: "Recommendations only. Vendor purchasing is not connected. Usage logging, confirmed package prices, delivery times, and spending limits are required before automatic ordering.",
  };
}
