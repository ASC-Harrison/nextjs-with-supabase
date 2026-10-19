export type ReorderItem = {
  item_id: string; name: string; reference_number: string | null; vendor: string | null;
  total_on_hand: number | null; par_level: number | null; low_level: number | null;
  unit: string | null; backordered?: boolean | null;
};
export type ReorderOrder = {
  item_id: string | null; reference_number: string | null; status: string; unit: string | null;
  qty_requested: number | null; qty_actual_ordered: number | null; qty_actual_received: number | null;
};
export type ReorderMeta = { id: string; price: number | null; units_per_box: number | null };
const closed = new Set(["RECEIVED", "CANCELLED", "CANCELED", "COMPLETED"]);
function unit(value: string | null) {
  const v = (value || "").trim().toLowerCase();
  if (["ea", "each", "unit", "units"].includes(v)) return "each";
  if (["bx", "box", "boxes"].includes(v)) return "box";
  if (["cs", "case", "cases"].includes(v)) return "case";
  return v;
}
export function buildReorderPlan(items: ReorderItem[], orders: ReorderOrder[], metadata: ReorderMeta[]) {
  const meta = new Map(metadata.map(row => [row.id, row]));
  return items.map(item => {
    const onHand = item.total_on_hand;
    const par = Math.max(0, Number(item.par_level || 0));
    const low = Math.max(0, Number(item.low_level || 0));
    const active = orders.filter(order => !closed.has(order.status.trim().toUpperCase()) &&
      (order.item_id === item.item_id || (!order.item_id && Boolean(item.reference_number) && order.reference_number === item.reference_number)));
    const mismatch = active.some(order => !unit(item.unit) || unit(order.unit) !== unit(item.unit));
    const openQty = active.reduce((sum, order) => sum + Math.max(0, Number(order.qty_actual_ordered ?? order.qty_requested ?? 0) - Number(order.qty_actual_received ?? 0)), 0);
    const shortage = onHand === null ? null : Math.max(0, par - onHand);
    const suggested = shortage === null || mismatch || par <= 0 || !unit(item.unit) ? null : Math.ceil(Math.max(0, shortage - openQty));
    const info = meta.get(item.item_id);
    // Existing prices have a package basis that is not independently verified.
    const price = Number(info?.price || 0);
    const blockers: string[] = [];
    if (onHand === null) blockers.push("Stock count missing");
    if (par <= 0) blockers.push("Set a PAR target");
    if (!unit(item.unit)) blockers.push("Confirm inventory unit");
    if (mismatch) blockers.push("Open order units differ — verify boxes, cases, and each");
    if (active.length) blockers.push("Review existing requests before another order");
    if (!item.vendor) blockers.push("Vendor missing");
    if (price <= 0) blockers.push("Price missing");
    else blockers.push("Confirm price and package basis");
    const status = onHand === null ? "CHECK DATA" : onHand <= 0 ? "OUT OF STOCK" : low > 0 && onHand <= low ? "LOW STOCK" : par > 0 && onHand < par ? "BELOW PAR" : "AT TARGET";
    return {
      ...item, on_hand: onHand, par, low, status, open_orders: active.length,
      open_quantity: mismatch ? null : openQty, suggested_quantity: suggested,
      possible_duplicate: active.length > 0,
      saved_price: price > 0 ? price : null,
      blockers,
      reason: onHand === null ? "Count this item before planning." : par <= 0 ? "A stock target is needed before calculating an order." : mismatch ? "An open order uses different or unknown units; quantity calculation paused." : `${onHand} on hand + ${openQty} already requested, against a PAR target of ${par}.`,
    };
  }).sort((a, b) => {
    const priority = ["OUT OF STOCK", "LOW STOCK", "BELOW PAR", "CHECK DATA", "AT TARGET"];
    return priority.indexOf(a.status) - priority.indexOf(b.status) || a.name.localeCompare(b.name);
  });
}
export type ReorderRow = ReturnType<typeof buildReorderPlan>[number];
