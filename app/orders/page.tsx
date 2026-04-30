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
  .filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
  .filter-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;transition:all 0.18s;font-family:inherit;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .filter-btn.off:hover{color:#f0f6ff;}
  .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center;}
  .stat-val{font-size:26px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .order-card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;}
  .order-card.PENDING::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#f59e0b;}
  .order-card.ORDERED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#3b82f6;}
  .order-card.RECEIVED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#10b981;}
  .order-name{font-size:15px;font-weight:800;color:#f0f6ff;word-break:break-word;margin-bottom:4px;}
  .order-meta{font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.5;}
  .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.3px;}
  .badge-pending{background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .badge-ordered{background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);}
  .badge-backordered{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .order-card.BACKORDERED::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#ef4444;}
  .btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-ok{background:#10b981;color:#fff;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .action-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .time{font-size:11px;color:#334155;}
  .empty{text-align:center;padding:48px 20px;color:#334155;font-size:14px;}
  .loading{text-align:center;padding:40px;color:#64748b;}
  .refresh-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;color:#94a3b8;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;margin-left:auto;display:block;margin-bottom:12px;}
`;

const STATUS_FILTERS = ["ALL", "PENDING", "ORDERED", "BACKORDERED", "RECEIVED"];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("order_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setOrders((data as Order[]) ?? []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadOrders(); }, []);
  useEffect(() => {
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const update: any = { status };
      if (status === "ORDERED") { update.confirmed_by = "Admin"; update.confirmed_at = new Date().toISOString(); }
      if (status === "RECEIVED") { update.received_at = new Date().toISOString(); }
      await supabase.from("order_requests").update(update).eq("id", id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...update } : o));
    } catch {}
    finally { setUpdating(null); }
  }

  const filtered = filter === "ALL" ? orders : orders.filter(o => o.status === filter);
  const pending = orders.filter(o => o.status === "PENDING").length;
  const ordered = orders.filter(o => o.status === "ORDERED").length;
  const received = orders.filter(o => o.status === "RECEIVED").length;

  const backordered = orders.filter(o => o.status === "BACKORDERED").length;
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="title">Order Management</div>
          <div className="sub">Track all order requests — pending, ordered, and received.</div>

          <div className="stats-row" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
            <div className="stat">
              <div className="stat-val" style={{color:"#fcd34d"}}>{pending}</div>
              <div className="stat-lbl">Pending</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{color:"#93c5fd"}}>{ordered}</div>
              <div className="stat-lbl">Ordered</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{color:"#fca5a5"}}>{backordered}</div>
              <div className="stat-lbl">Backordered</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{color:"#6ee7b7"}}>{received}</div>
              <div className="stat-lbl">Received</div>
            </div>
          </div>

          <div className="filter-row">
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? "on" : "off"}`}>{f}</button>
            ))}
          </div>

          <button onClick={loadOrders} className="refresh-btn">⟳ Refresh</button>

          {loading ? (
            <div className="loading">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {filter === "ALL" ? "No orders yet. Send an order request from the inventory app." : `No ${filter.toLowerCase()} orders.`}
            </div>
          ) : (
            filtered.map(order => (
              <div key={order.id} className={`order-card ${order.status}`}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div className="order-name">{order.item_name}</div>
                    <div className="order-meta">
                      Ref: {order.reference_number||"—"} · Vendor: {order.vendor||"—"} · {order.unit||"—"}<br/>
                      Qty: <strong style={{color:"#f0f6ff"}}>{order.qty_requested}</strong> · Requested by: {order.requested_by}<br/>
                      <span className="time">{formatTime(order.created_at)}</span>
                    </div>
                    {order.confirmed_by && (
                      <div style={{fontSize:11,color:"#93c5fd",marginBottom:4}}>
                        ✅ Confirmed by {order.confirmed_by} · {order.confirmed_at ? formatTime(order.confirmed_at) : ""}
                      </div>
                    )}
                    {order.received_at && (
                      <div style={{fontSize:11,color:"#6ee7b7",marginBottom:4}}>
                        📦 Received · {formatTime(order.received_at)}
                      </div>
                    )}
                  </div>
                  <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
                </div>
                <div className="action-row">
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "ORDERED")} disabled={updating === order.id} className="btn btn-ac">
                      {updating === order.id ? "Updating…" : "✅ Mark as Ordered"}
                    </button>
                  )}
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "BACKORDERED")} disabled={updating === order.id} className="btn" style={{background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)"}}>
                      🔴 Backordered
                    </button>
                  )}
                  {(order.status === "ORDERED" || order.status === "BACKORDERED") && (
                    <button onClick={() => updateStatus(order.id, "RECEIVED")} disabled={updating === order.id} className="btn btn-ok">
                      {updating === order.id ? "Updating…" : "📦 Mark as Received"}
                    </button>
                  )}
                  {order.status === "PENDING" && (
                    <button onClick={() => updateStatus(order.id, "RECEIVED")} disabled={updating === order.id} className="btn btn-gh" style={{fontSize:11}}>
                      Skip to Received
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
