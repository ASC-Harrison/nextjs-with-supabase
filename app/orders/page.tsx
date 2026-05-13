"use client";

import { useEffect, useState } from "react";
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
  status: "PENDING" | "ORDERED" | "BACKORDERED" | "RECEIVED";
  confirmed_by: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  notes: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .title{font-size:26px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:20px;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center;}
  .stat-val{font-size:24px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .filter-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;transition:all 0.18s;font-family:inherit;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .filter-btn.off:hover{color:#f0f6ff;}
  .refresh-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;color:#94a3b8;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;margin-bottom:12px;}
  .order-card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;}
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
  .auto-refresh{font-size:11px;color:#334155;margin-bottom:12px;}
`;

const STATUS_FILTERS = ["ALL", "PENDING", "ORDERED", "BACKORDERED", "RECEIVED"];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [qtyReceivedInput, setQtyReceivedInput] = useState<string>("");

  async function loadOrders() {
    try {
      const { data } = await supabase
        .from("order_requests")
        .select("*,item_id")
        .order("created_at", { ascending: false })
        .limit(200);
      setOrders((data as Order[]) ?? []);
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
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="title">Order Management</div>
          <div className="sub">Track all order requests — pending, ordered, backordered, and received.</div>

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
                      <div className="confirmed-note">{"✅ Confirmed by " + order.confirmed_by + (order.confirmed_at ? " · " + formatTime(order.confirmed_at) : "")}</div>
                    )}
                    {order.confirmed_by && order.status === "BACKORDERED" && (
                      <div className="backorder-note">{"🔴 Backordered — reported by " + order.confirmed_by + (order.confirmed_at ? " · " + formatTime(order.confirmed_at) : "")}</div>
                    )}
                    {order.received_at && (
                      <div className="received-note">{"📦 Received · " + formatTime(order.received_at)}</div>
                    )}
                  </div>
                  <span className={getBadgeClass(order.status)}>{order.status}</span>
                </div>

                {/* Qty received input when marking as received */}
                {receivingId === order.id && (
                  <div style={{ marginTop:10, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontSize:12, color:"#6ee7b7", fontWeight:700, marginBottom:8 }}>Enter actual quantity received:</div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <input
                        type="number"
                        value={qtyReceivedInput}
                        onChange={e => setQtyReceivedInput(e.target.value)}
                        placeholder={String(order.qty_actual_ordered || order.qty_requested)}
                        min="1"
                        style={{ flex:1, borderRadius:8, border:"1px solid rgba(16,185,129,0.3)", background:"#111827", color:"#f0f6ff", padding:"10px 12px", fontSize:15, fontWeight:800, textAlign:"center", fontFamily:"inherit", outline:"none" }}
                      />
                      <button
                        onClick={async () => {
                          if(updating) return;
                          setUpdating(order.id);
                          try {
                            const qtyReceived = qtyReceivedInput.trim() ? Number(qtyReceivedInput) : (order.qty_actual_ordered || order.qty_requested);
                            if(!qtyReceived || qtyReceived <= 0) { alert("Please enter a valid quantity received."); setUpdating(null); return; }
                            const update: any = { status: "RECEIVED", received_at: new Date().toISOString(), qty_actual_received: qtyReceived };
                            await supabase.from("order_requests").update(update).eq("id", order.id);

                            // Add to MAIN SUPPLY inventory if item_id exists
                            if ((order as any).item_id && qtyReceived > 0) {
                              await Promise.resolve(supabase.rpc("add_stock", {
                                p_item_id: (order as any).item_id,
                                p_area_id: "a09eb27b-e4a1-449a-8d2e-c45b24d6514f",
                                p_qty: qtyReceived,
                              })).catch(() => {});
                            }

                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...update } as Order : o));
                            setReceivingId(null);
                            setQtyReceivedInput("");
                          } catch {}
                          finally { setUpdating(null); }
                        }}
                        disabled={updating === order.id}
                        className="btn btn-ok"
                      >
                        {updating === order.id ? "…" : "Confirm"}
                      </button>
                      <button onClick={() => { setReceivingId(null); setQtyReceivedInput(""); }} className="btn btn-gh">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="action-row">
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "ORDERED")} disabled={updating === order.id} className="btn btn-ac">
                      {updating === order.id ? "Updating…" : "✅ Mark Ordered"}
                    </button>
                  )}
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "BACKORDERED")} disabled={updating === order.id} className="btn btn-err">
                      {updating === order.id ? "Updating…" : "🔴 Backordered"}
                    </button>
                  )}
                  {(order.status === "ORDERED" || order.status === "BACKORDERED") && receivingId !== order.id && (
                    <button onClick={() => { setReceivingId(order.id); setQtyReceivedInput(String(order.qty_actual_ordered || order.qty_requested)); }} disabled={updating === order.id} className="btn btn-ok">
                      📦 Mark Received
                    </button>
                  )}
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "RECEIVED")} disabled={updating === order.id} className="btn btn-gh" style={{ fontSize: 11 }}>
                      Skip to Received
                    </button>
                  )}
                  <button onClick={() => updateStatus(order.id, "PENDING")} disabled={updating === order.id} className="btn btn-gh" style={{ fontSize: 11 }}>
                    ↩️ Reset
                  </button>
                  <button onClick={async () => { if(!confirm("Delete this order request permanently?")) return; setUpdating(order.id); try { await supabase.from("order_requests").delete().eq("id", order.id); setOrders(prev => prev.filter(o => o.id !== order.id)); } catch {} finally { setUpdating(null); } }} disabled={updating === order.id} className="btn" style={{ fontSize:11, background:"rgba(239,68,68,0.15)", color:"#fca5a5", border:"1px solid rgba(239,68,68,0.3)" }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
