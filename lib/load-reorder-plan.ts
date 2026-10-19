import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildReorderPlan, type ReorderItem, type ReorderMeta, type ReorderOrder } from "@/lib/reorder-plan";
import { gateReorderCounts, type CountLocation, type CountVerification } from "@/lib/reorder-verification";

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
  const [items, orders, metadata, locations, verifications, areas] = await Promise.all([
    allPages<ReorderItem>((from, to) => supabaseAdmin.from("building_inventory_sheet_view").select("item_id,name,reference_number,vendor,total_on_hand,par_level,low_level,unit,backordered").eq("is_active", true).order("item_id").range(from, to)),
    allPages<ReorderOrder>((from, to) => supabaseAdmin.from("order_requests").select("item_id,reference_number,status,unit,qty_requested,qty_actual_ordered,qty_actual_received").not("status", "in", "(RECEIVED,CANCELLED,CANCELED,COMPLETED)").order("id").range(from, to)),
    allPages<ReorderMeta>((from, to) => supabaseAdmin.from("items").select("id,price,units_per_box").eq("is_active", true).order("id").range(from, to)),
    allPages<CountLocation>((from, to) => supabaseAdmin.from("storage_inventory").select("item_id,storage_area_id,on_hand,updated_at").order("item_id").order("storage_area_id").range(from, to)),
    allPages<CountVerification>((from, to) => supabaseAdmin.from("inventory_count_verifications").select("item_id,storage_area_id,actual_on_hand,verified_at,verified_by").gte("verified_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order("verified_at", {ascending: false}).order("id").range(from, to)),
    allPages<{id: string; name: string}>((from, to) => supabaseAdmin.from("storage_areas").select("id,name").eq("active", true).order("id").range(from, to)),
  ]);
  const rows = gateReorderCounts(buildReorderPlan(items, orders, metadata), locations, verifications, areas);
  return {
    generated_at: new Date().toISOString(), rows,
    summary: {
      active_items: rows.length,
      out_of_stock: rows.filter(row => row.status === "OUT OF STOCK").length,
      needs_reorder: rows.filter(row => (row.suggested_quantity ?? 0) > 0).length,
      existing_requests: rows.filter(row => row.open_orders > 0).length,
      missing_targets: rows.filter(row => row.par <= 0).length,
      needs_shelf_check: rows.filter(row => !row.count_verified && row.status !== "AT TARGET").length,
    },
    automation: "Verify before ordering. Suggested quantities are withheld until all recorded locations were counted within 24 hours and are unchanged since verification. A verified count is not order approval. Requests and purchases still require manual review; nothing is automatically sent.",
  };
}
