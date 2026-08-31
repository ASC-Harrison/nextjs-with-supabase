"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Order = {
  id: string;
  created_at: string;
  requested_by: string;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty_requested: number;
  item_id?: string | null;
  qty_actual_ordered: number | null;
  qty_actual_received: number | null;
  status: "PENDING" | "ORDERED" | "BACKORDERED" | "RECEIVED" | "AWAITING";
  partial_note?: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  received_by?: string | null;
  expected_delivery_date?: string | null;
  notes: string | null;
  alert_note?: string | null;
  current_price?: number | null;
  current_units_per_box?: number | null;
  current_price_source?: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#080d19;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;color:#f0f6ff;padding:12px 14px 90px;background:radial-gradient(circle at 12% 0%,rgba(37,99,235,.16),transparent 31%),radial-gradient(circle at 100% 22%,rgba(45,212,191,.07),transparent 28%),#080d19;}
  .wrap{max-width:900px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.14);border-radius:10px;padding:8px 13px;font-size:12px;font-weight:750;color:#94a3b8;cursor:pointer;margin-bottom:10px;font-family:inherit;}
  .orders-hero{position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(30,41,59,.96),rgba(15,23,42,.96));border:1px solid rgba(96,165,250,.2);border-radius:21px;padding:18px;margin-bottom:13px;box-shadow:0 22px 55px rgba(0,0,0,.24);}
  .orders-hero::before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2dd4bf);}
  .hero-line{display:flex;align-items:center;gap:12px;}
  .hero-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#2563eb,#0891b2);box-shadow:0 11px 24px rgba(37,99,235,.27);font-size:22px;}
  .title{font-size:24px;font-weight:950;color:#f8fafc;letter-spacing:-0.7px;margin-bottom:3px;}
  .sub{font-size:11px;color:#94a3b8;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;}
  .stat{background:rgba(2,6,23,.4);border:1px solid rgba(148,163,184,.11);border-radius:12px;padding:11px;text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.02);}
  .stat-val{font-size:24px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .filter-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;transition:all 0.18s;font-family:inherit;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .filter-btn.off:hover{color:#f0f6ff;}
  .refresh-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;color:#94a3b8;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;margin-bottom:12px;}
  .order-card{background:linear-gradient(145deg,rgba(30,41,59,.85),rgba(15,23,42,.9));border:1px solid rgba(148,163,184,.13);border-radius:16px;padding:15px;margin-bottom:10px;position:relative;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.13);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;}
  .order-card.PENDING::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#f59e0b;}
  .order-card.ORDERED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#3b82f6;}
  .order-card.BACKORDERED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#ef4444;}
  .order-card.RECEIVED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#10b981;}
  .order-name{font-size:15px;font-weight:800;color:#f0f6ff;word-break:break-word;margin-bottom:4px;}
  .order-meta{font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.6;}
  .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.3px;}
  .badge-pending{background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .badge-ordered{background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);}
  .badge-backordered{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .badge-received{background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-ok{background:#10b981;color:#fff;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-err{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .action-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .confirmed-note{font-size:11px;color:#93c5fd;margin-bottom:4px;}
  .received-note{font-size:11px;color:#6ee7b7;margin-bottom:4px;}
  .backorder-note{font-size:11px;color:#fca5a5;margin-bottom:4px;}
  .empty{text-align:center;padding:48px 20px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:40px;color:#64748b;font-size:13px;}
  .auto-refresh{font-size:11px;color:#475569;margin-bottom:12px;}
  @media(hover:hover){.order-card:hover{transform:translateY(-1px);border-color:rgba(96,165,250,.22);box-shadow:0 18px 40px rgba(0,0,0,.18);}}
  @media(max-width:560px){.root{padding:9px 9px 90px}.stats-row{grid-template-columns:1fr 1fr}.orders-hero{padding:15px}.title{font-size:21px}}
`;

const STATUS_FILTERS = ["ALL", "PENDING", "ORDERED", "BACKORDERED", "AWAITING", "RECEIVED"];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);
  const [isReadOnly] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem("asc_readonly") === "true");
  const [staffName, setStaffName] = useState("Admin");\n  const receiveIntentHandled = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      if(data.session?.user) setStaffName(data.session.user.user_metadata?.full_name || data.session.user.email || "Admin");
    });
  }, []);
  const [expectedDeliveryInput, setExpectedDeliveryInput] = useState<string>("");
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [qtyReceivedInput, setQtyReceivedInput] = useState<string>("");
  const [partialNoteInput, setPartialNoteInput] = useState<string>("");
  const [receivingPriceInput, setReceivingPriceInput] = useState<string>("");
  const [receivingPackageQtyInput, setReceivingPackageQtyInput] = useState<string>("1");
  const [receivingVendorInput, setReceivingVendorInput] = useState<string>("");
  const [receivingSourceInput, setReceivingSourceInput] = useState<string>("Invoice");

  async function loadOrders() {
    try {
      const { data } = await supabase
        .from("order_requests")
        .select("*,item_id")
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data as Order[]) ?? [];
      const ids = [...new Set(rows.map(r => r.item_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: itemData } = await supabase
          .from("items")
          .select("id,alert_note,notes,price,units_per_box,price_source,vendor")
          .in("id", ids);
        if (itemData) {
          const itemMap = Object.fromEntries(itemData.map((item: any) => [item.id, item]));
          rows.forEach(row => {
            if (!row.item_id) return;
            const item = itemMap[row.item_id];
            if (!item) return;
            row.alert_note = item.alert_note || item.notes || null;
            row.current_price = item.price;
            row.current_units_per_box = item.units_per_box;
            row.current_price_source = item.price_source;
            if (!row.vendor && item.vendor) row.vendor = item.vendor;
          });
        }
      }
      setOrders(rows);

      if (!receiveIntentHandled.current && typeof window !== "undefined") {
        const receiveId = new URLSearchParams(window.location.search).get("receive");
        const target = receiveId ? rows.find(row => row.id === receiveId) : null;
        if (target) {
          receiveIntentHandled.current = true;
          window.history.replaceState({}, "", "/orders");
          if (target.status === "RECEIVED") {
            alert("This order has already been received.");
          } else {
            openReceiving(target);
          }
        }
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const update: Record<string, string | null> = { status };
      if (status === "ORDERED" || status === "BACKORDERED") {
        update.confirmed_by = "Admin";
        update.confirmed_at = new Date().toISOString();
      }
      if (status === "RECEIVED") {
        update.received_at = new Date().toISOString();
        update.received_by = staffName;
      }
      if (status === "PENDING") {
        update.confirmed_by = null;
        update.confirmed_at = null;
        update.received_at = null;
      }
      await supabase.from("order_requests").update(update).eq("id", id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...update } as Order : o));
    } catch {}
    finally { setUpdating(null); }
  }

  function openReceiving(order: Order) {
    setReceivingId(order.id);
    setQtyReceivedInput("");
    setPartialNoteInput("");
    setReceivingPriceInput("");
    setReceivingPackageQtyInput(String(order.current_units_per_box || 1));
    setReceivingVendorInput(order.vendor || "");
    setReceivingSourceInput("Invoice");
  }

  function closeReceiving() {
    setReceivingId(null);
    setQtyReceivedInput("");
    setPartialNoteInput("");
    setReceivingPriceInput("");
    setReceivingPackageQtyInput("1");
    setReceivingVendorInput("");
    setReceivingSourceInput("Invoice");
  }

  async function receiveOrderIntoInventory(order: Order, complete: boolean) {
    if (updating) return;

    const orderedQty = order.qty_actual_ordered || order.qty_requested;
    const alreadyReceived = order.qty_actual_received || 0;
    const suggestedQty = Math.max(orderedQty - alreadyReceived, 1);
    const qtyReceived = qtyReceivedInput.trim() ? Number(qtyReceivedInput) : suggestedQty;

    if (!Number.isInteger(qtyReceived) || qtyReceived <= 0) {
      alert("Please enter a valid whole-number quantity received.");
      return;
    }

    const partialNote = partialNoteInput.trim();
    if (!complete && !partialNote) {
      alert("Add a note explaining what is still expected.");
      return;
    }

    const packagePrice = receivingPriceInput.trim() ? Number(receivingPriceInput) : null;
    const packageQty = receivingPackageQtyInput.trim() ? Number(receivingPackageQtyInput) : 1;
    if (packagePrice !== null && (!Number.isFinite(packagePrice) || packagePrice < 0)) {
      alert("Please enter a valid invoice price.");
      return;
    }
    if (packagePrice !== null && (!Number.isInteger(packageQty) || packageQty < 1)) {
      alert("Units in the package must be a whole number of at least 1.");
      return;
    }

    const actionLabel = complete ? "complete this order" : "keep the rest awaiting";
    const pricingSummary = packagePrice === null
      ? "No pricing change will be made."
      : `Invoice price: $${packagePrice.toFixed(2)} per package of ${packageQty} ($${(packagePrice / packageQty).toFixed(2)} each).`;
    if (!confirm(`Receive ${qtyReceived} of "${order.item_name}" into MAIN STERILE SUPPLY inventory and ${actionLabel}?\n\n${pricingSummary}`)) {
      return;
    }

    setUpdating(order.id);
    try {
      const { data, error } = await supabase.rpc("receive_order_with_pricing", {
        p_order_id: order.id,
        p_qty: qtyReceived,
        p_complete: complete,
        p_staff: staffName,
        p_partial_note: complete ? null : partialNote,
        p_package_price: packagePrice,
        p_units_per_package: packagePrice === null ? null : packageQty,
        p_vendor: packagePrice === null ? null : receivingVendorInput.trim() || null,
        p_price_source: packagePrice === null ? null : receivingSourceInput || "Invoice",
      });

      if (error) throw error;

      const result = data as {
        status: Order["status"];
        total_received: number;
        inventory_on_hand: number;
        pricing_updated: boolean;
        package_price: number | null;
        unit_cost: number | null;
      };

      const receivedAt = complete ? new Date().toISOString() : null;
      setOrders(prev => prev.map(row => row.id === order.id ? {
        ...row,
        status: result.status,
        qty_actual_received: result.total_received,
        received_by: staffName,
        received_at: receivedAt,
        partial_note: complete ? null : partialNote,
        current_price: result.package_price ?? row.current_price,
        current_units_per_box: result.package_price !== null ? packageQty : row.current_units_per_box,
        current_price_source: result.package_price !== null ? receivingSourceInput : row.current_price_source,
        vendor: result.package_price !== null ? receivingVendorInput || row.vendor : row.vendor,
      } as Order : row));

      closeReceiving();
      const priceMessage = result.package_price !== null
        ? ` Price recorded at $${Number(result.package_price).toFixed(2)} per package${result.unit_cost !== null ? ` ($${Number(result.unit_cost).toFixed(2)} each)` : ""}.`
        : "";
      alert(`Received ${qtyReceived}. Main Sterile Supply now has ${result.inventory_on_hand} on hand.${priceMessage}`);
    } catch (error: any) {
      alert(`Could not receive this order: ${error?.message || "Unknown error"}`);
    } finally {
      setUpdating(null);
    }
  }

  const filtered = filter === "ALL" ? orders : orders.filter(o => o.status === filter);
  const pending = orders.filter(o => o.status === "PENDING").length;
  const ordered = orders.filter(o => o.status === "ORDERED").length;
  const backordered = orders.filter(o => o.status === "BACKORDERED").length;
  const received = orders.filter(o => o.status === "RECEIVED").length;

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function getBadgeClass(status: string) {
    if (status === "PENDING") return "badge badge-pending";
    if (status === "ORDERED") return "badge badge-ordered";
    if (status === "BACKORDERED") return "badge badge-backordered";
    return "badge badge-received";
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Dashboard</button>
          <section className="orders-hero">
            <div className="hero-line">
              <div className="hero-icon">📦</div>
              <div>
                <div className="title">Orders & Receiving</div>
                <div className="sub">Track requests, deliveries, inventory updates, and invoice pricing.</div>
              </div>
            </div>

            <div className="stats-row">
            <div className="stat">
              <div className="stat-val" style={{ color: "#fcd34d" }}>{pending}</div>
              <div className="stat-lbl">Pending</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: "#93c5fd" }}>{ordered}</div>
              <div className="stat-lbl">Ordered</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: "#fca5a5" }}>{backordered}</div>
              <div className="stat-lbl">Backordered</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: "#6ee7b7" }}>{received}</div>
              <div className="stat-lbl">Received</div>
            </div>
            </div>
          </section>

          <div className="filter-row">
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={"filter-btn " + (filter === f ? "on" : "off")}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="auto-refresh">Auto-refreshes every 15 seconds</div>
            <button onClick={loadOrders} className="refresh-btn">⟳ Refresh Now</button>
          </div>

          {loading ? (
            <div className="loading">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {filter === "ALL"
                ? "No orders yet. Send an order request from the Totals tab."
                : "No " + filter.toLowerCase() + " orders."}
            </div>
          ) : (
            filtered.map(order => (
              <div key={order.id} className={"order-card " + order.status}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="order-name">{order.item_name}</div>
                    {order.alert_note && (
                      <div style={{ fontSize:11, color:"#fcd34d", marginTop:2, marginBottom:4, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:6, padding:"3px 8px", display:"inline-block" }}>⚡ {order.alert_note}</div>
                    )}
                    <div className="order-meta">
                      {"Ref: " + (order.reference_number || "—") + " · Vendor: " + (order.vendor || "—") + " · " + (order.unit || "—")}<br />
                      {"Requested: "}<strong style={{ color: "#f0f6ff" }}>{order.qty_requested}</strong>
                      {order.qty_actual_ordered && order.qty_actual_ordered !== order.qty_requested && (
                        <span style={{ color:"#fcd34d" }}>{" → Actual: "}<strong>{order.qty_actual_ordered}</strong></span>
                      )}
                      {order.qty_actual_received && (
                        <span style={{ color:"#6ee7b7" }}>{" · Received: "}<strong>{order.qty_actual_received}</strong></span>
                      )}
                      {" · By: " + order.requested_by}<br />
                      <span style={{ fontSize: 10, color: "#334155" }}>{formatTime(order.created_at)}</span>
                    </div>
                    {order.confirmed_by && order.status === "ORDERED" && (
                      <div className="confirmed-note">
                        {"✅ Confirmed by " + order.confirmed_by + (order.confirmed_at ? " · " + formatTime(order.confirmed_at) : "")}
                        {order.expected_delivery_date && (() => {
                          const today = new Date(); today.setHours(0,0,0,0);
                          const del = new Date(order.expected_delivery_date + "T00:00:00");
                          const diff = Math.ceil((del.getTime() - today.getTime()) / (1000*60*60*24));
                          if (diff < 0) return <span style={{marginLeft:6,fontSize:10,fontWeight:800,color:"#fca5a5",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,padding:"1px 6px"}}>⚠️ OVERDUE</span>;
                          if (diff === 0) return <span style={{marginLeft:6,fontSize:10,fontWeight:800,color:"#fcd34d",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:4,padding:"1px 6px"}}>📦 DUE TODAY</span>;
                          return <span style={{marginLeft:6,fontSize:10,color:"#64748b"}}>Due {del.toLocaleDateString()}</span>;
                        })()}
                      </div>
                    )}
                    {order.confirmed_by && order.status === "BACKORDERED" && (
                      <div className="backorder-note">{"🔴 Backordered — reported by " + order.confirmed_by + (order.confirmed_at ? " · " + formatTime(order.confirmed_at) : "")}</div>
                    )}
                    {order.received_at && (
                      <div className="received-note">{"📦 Received · " + formatTime(order.received_at) + (order.received_by ? " · by " + order.received_by : "")}</div>
                    )}
                    {order.status === "AWAITING" && order.partial_note && (
                      <div style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#fcd34d", marginBottom:6 }}>
                        🕐 <strong>Awaiting rest of order</strong>
                        {order.qty_actual_received != null && <span> · {order.qty_actual_received} received so far</span>}
                        <br />{order.partial_note}
                      </div>
                    )}

                  </div>
                  <span className={getBadgeClass(order.status)}>{order.status}</span>
                </div>

                {/* Receiving adds stock and updates the order in one atomic database action. */}
                {receivingId === order.id && (() => {
                  const orderedQty = order.qty_actual_ordered || order.qty_requested;
                  const alreadyReceived = order.qty_actual_received || 0;
                  const suggestedQty = Math.max(orderedQty - alreadyReceived, 1);
                  return (
                    <div style={{ marginTop:10, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, padding:"12px" }}>
                      <div style={{ fontSize:12, color:"#6ee7b7", fontWeight:800, marginBottom:4 }}>Receive directly into inventory</div>
                      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:8 }}>
                        Enter what arrived today. This amount will be added immediately to <strong style={{color:"#f0f6ff"}}>Main Sterile Supply</strong>.
                      </div>
                      <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
                        Ordered: <strong style={{color:"#f0f6ff"}}>{orderedQty}</strong>
                        {alreadyReceived > 0 && <span> · Previously received: <strong style={{color:"#6ee7b7"}}>{alreadyReceived}</strong></span>}
                        <span> · Suggested now: <strong style={{color:"#93c5fd"}}>{suggestedQty}</strong></span>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={qtyReceivedInput}
                        onChange={e => setQtyReceivedInput(e.target.value)}
                        placeholder={String(suggestedQty)}
                        min="1"
                        step="1"
                        style={{ width:"100%", borderRadius:8, border:"1px solid rgba(16,185,129,0.3)", background:"#111827", color:"#f0f6ff", padding:"11px 12px", fontSize:16, fontWeight:800, textAlign:"center", fontFamily:"inherit", outline:"none", marginBottom:10 }}
                      />

                      <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:10, padding:"10px", marginBottom:10 }}>
                        <div style={{ fontSize:12, color:"#93c5fd", fontWeight:800, marginBottom:3 }}>Invoice pricing (optional)</div>
                        <div style={{ fontSize:10, color:"#64748b", marginBottom:8 }}>
                          Enter the actual package price from the invoice. Leave price blank to receive inventory without changing pricing.
                          {order.current_price != null && <span style={{color:"#94a3b8"}}> Current saved price: <strong style={{color:"#f0f6ff"}}>${Number(order.current_price).toFixed(2)}</strong>.</span>}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginBottom:7 }}>
                          <div>
                            <div style={{fontSize:9,color:"#64748b",fontWeight:800,margin:"0 0 4px 2px"}}>PACKAGE PRICE</div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={receivingPriceInput}
                              onChange={e => setReceivingPriceInput(e.target.value)}
                              placeholder="0.00"
                              style={{width:"100%",borderRadius:8,border:"1px solid rgba(59,130,246,0.25)",background:"#111827",color:"#f0f6ff",padding:"9px",fontSize:13,fontFamily:"inherit",outline:"none"}}
                            />
                          </div>
                          <div>
                            <div style={{fontSize:9,color:"#64748b",fontWeight:800,margin:"0 0 4px 2px"}}>UNITS IN PACKAGE</div>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              value={receivingPackageQtyInput}
                              onChange={e => setReceivingPackageQtyInput(e.target.value)}
                              style={{width:"100%",borderRadius:8,border:"1px solid rgba(59,130,246,0.25)",background:"#111827",color:"#f0f6ff",padding:"9px",fontSize:13,fontFamily:"inherit",outline:"none"}}
                            />
                          </div>
                        </div>
                        <input
                          value={receivingVendorInput}
                          onChange={e => setReceivingVendorInput(e.target.value)}
                          placeholder="Vendor"
                          style={{width:"100%",borderRadius:8,border:"1px solid rgba(59,130,246,0.25)",background:"#111827",color:"#f0f6ff",padding:"9px",fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:7}}
                        />
                        <select
                          value={receivingSourceInput}
                          onChange={e => setReceivingSourceInput(e.target.value)}
                          style={{width:"100%",borderRadius:8,border:"1px solid rgba(59,130,246,0.25)",background:"#111827",color:"#f0f6ff",padding:"9px",fontSize:12,fontFamily:"inherit",outline:"none"}}
                        >
                          <option value="Invoice">Invoice</option>
                          <option value="Packing slip">Packing slip</option>
                          <option value="Vendor quote">Vendor quote</option>
                          <option value="Contract">Contract</option>
                          <option value="Other">Other</option>
                        </select>
                        {receivingPriceInput && Number(receivingPriceInput) >= 0 && Number(receivingPackageQtyInput) > 0 && (
                          <div style={{fontSize:11,color:"#6ee7b7",fontWeight:800,marginTop:8,textAlign:"center"}}>
                            Cost per individual unit: ${(Number(receivingPriceInput) / Number(receivingPackageQtyInput)).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => receiveOrderIntoInventory(order, true)}
                        disabled={updating === order.id}
                        className="btn btn-ok"
                        style={{ width:"100%", padding:"11px 14px", fontSize:13, marginBottom:10 }}
                      >
                        {updating === order.id ? "Receiving…" : "📦 Receive & Add to Inventory"}
                      </button>
                      <div style={{ fontSize:11, color:"#fcd34d", fontWeight:700, marginBottom:4 }}>Only part of the order arrived?</div>
                      <textarea
                        value={partialNoteInput}
                        onChange={e => setPartialNoteInput(e.target.value)}
                        placeholder="What is still expected or backordered?"
                        rows={2}
                        style={{ width:"100%", borderRadius:8, border:"1px solid rgba(245,158,11,0.3)", background:"#111827", color:"#f0f6ff", padding:"8px 10px", fontSize:12, fontFamily:"inherit", outline:"none", resize:"vertical", marginBottom:8, boxSizing:"border-box" }}
                      />
                      <div style={{ display:"flex", gap:8 }}>
                        <button
                          onClick={() => receiveOrderIntoInventory(order, false)}
                          disabled={updating === order.id}
                          className="btn"
                          style={{ flex:1, background:"rgba(245,158,11,0.2)", color:"#fcd34d", border:"1px solid rgba(245,158,11,0.3)" }}
                        >
                          {updating === order.id ? "Receiving…" : "📦 Add Partial & Keep Awaiting"}
                        </button>
                        <button onClick={closeReceiving} className="btn btn-gh">Cancel</button>
                      </div>
                    </div>
                  );
                })()}
                <div className="action-row">
                  {!isReadOnly && order.status === "PENDING" && orderingId !== order.id && (
                    <button onClick={() => { setOrderingId(order.id); setExpectedDeliveryInput(""); }} disabled={updating === order.id} className="btn btn-ac">
                      ✅ Mark Ordered
                    </button>
                  )}
                  {!isReadOnly && order.status === "ORDERED" && orderingId !== order.id && (
                    <button onClick={() => { setOrderingId(order.id); setExpectedDeliveryInput(order.expected_delivery_date || ""); }} disabled={updating === order.id} className="btn btn-gh" style={{ fontSize:11 }}>
                      📅 {order.expected_delivery_date ? "Edit Delivery Date" : "Add Delivery Date"}
                    </button>
                  )}
                  {!isReadOnly && orderingId === order.id && (
                    <div style={{ marginTop:10, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:10, padding:"12px", width:"100%" }}>
                      <div style={{ fontSize:12, color:"#93c5fd", fontWeight:700, marginBottom:6 }}>
                        {order.status === "PENDING" ? "Expected delivery date (optional):" : "Expected delivery date:"}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                        <input type="date" value={expectedDeliveryInput} onChange={e => setExpectedDeliveryInput(e.target.value)} style={{ borderRadius:8, border:"1px solid rgba(59,130,246,0.3)", background:"#111827", color:"#f0f6ff", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                        <button onClick={async () => {
                          setUpdating(order.id);
                          try {
                            const update: any = order.status === "PENDING"
                              ? { status:"ORDERED", confirmed_by:"Admin", confirmed_at:new Date().toISOString() }
                              : {};
                            if (expectedDeliveryInput) update.expected_delivery_date = expectedDeliveryInput;
                            else update.expected_delivery_date = null;
                            await supabase.from("order_requests").update(update).eq("id", order.id);
                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...update } as Order : o));
                            setOrderingId(null); setExpectedDeliveryInput("");
                          } catch {} finally { setUpdating(null); }
                        }} disabled={updating === order.id} className="btn btn-ac" style={{ fontSize:12 }}>
                          {updating === order.id ? "Saving…" : order.status === "PENDING" ? "✅ Confirm Ordered" : "💾 Save Date"}
                        </button>
                        <button onClick={() => setOrderingId(null)} className="btn btn-gh" style={{ fontSize:11 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {!isReadOnly && order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "BACKORDERED")} disabled={updating === order.id} className="btn btn-err">
                      {updating === order.id ? "Updating…" : "🔴 Backordered"}
                    </button>
                  )}
                  {!isReadOnly && (order.status === "ORDERED" || order.status === "BACKORDERED" || order.status === "AWAITING") && receivingId !== order.id && (
                    <button onClick={() => openReceiving(order)} disabled={updating === order.id} className="btn btn-ok">
                      {order.status === "AWAITING" ? "📦 Receive Rest" : "📦 Mark Received"}
                    </button>
                  )}
                  {!isReadOnly && order.status === "PENDING" && receivingId !== order.id && (
                    <button onClick={() => openReceiving(order)} disabled={updating === order.id} className="btn btn-gh" style={{ fontSize:11 }}>
                      📦 Receive Now
                    </button>
                  )}
                  {!isReadOnly && (
                    <button onClick={() => updateStatus(order.id, "PENDING")} disabled={updating === order.id} className="btn btn-gh" style={{ fontSize:11 }}>
                      ↩️ Reset
                    </button>
                  )}
                  {!isReadOnly && (
                    <button onClick={async () => { if(!confirm("Delete this order request permanently?")) return; setUpdating(order.id); try { const res = await fetch("/api/orders/delete", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:order.id}) }); const json = await res.json(); if(json.ok) setOrders(prev => prev.filter(o => o.id !== order.id)); else alert(`Failed: ${json.error}`); } catch {} finally { setUpdating(null); } }} disabled={updating === order.id} className="btn" style={{ fontSize:11, background:"rgba(239,68,68,0.15)", color:"#fca5a5", border:"1px solid rgba(239,68,68,0.3)" }}>
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
