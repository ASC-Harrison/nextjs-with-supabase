"use client";

import { useEffect, useState, useMemo } from "react";
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
  qty_actual_ordered: number | null;
  qty_actual_received: number | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  expected_delivery_date: string | null;
  item_id: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px;text-align:center;}
  .stat-val{font-size:22px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .inp{border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:10px 14px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:180px;}
  .inp-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:32px;flex:none;}
  .timeline{position:relative;padding-left:24px;}
  .timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:2px;background:#1e3a5f;}
  .tl-item{position:relative;margin-bottom:16px;}
  .tl-dot{position:absolute;left:-20px;top:14px;width:10px;height:10px;border-radius:50%;border:2px solid;}
  .tl-dot.PENDING{background:#162032;border-color:#f59e0b;}
  .tl-dot.ORDERED{background:#3b82f6;border-color:#3b82f6;}
  .tl-dot.BACKORDERED{background:#ef4444;border-color:#ef4444;}
  .tl-dot.RECEIVED{background:#10b981;border-color:#10b981;}
  .tl-card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:14px;}
  .tl-card.RECEIVED{border-color:rgba(16,185,129,0.3);}
  .tl-card.BACKORDERED{border-color:rgba(239,68,68,0.3);}
  .tl-name{font-size:14px;font-weight:800;color:#f0f6ff;word-break:break-word;margin-bottom:4px;}
  .tl-meta{font-size:11px;color:#64748b;line-height:1.6;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;}
  .badge-pending{background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .badge-ordered{background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);}
  .badge-backordered{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .badge-received{background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .timeline-steps{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
  .step{font-size:10px;color:#64748b;display:flex;align-items:center;gap:4px;}
  .step.done{color:#6ee7b7;}
  .step.active{color:#f0f6ff;font-weight:700;}
  .empty{text-align:center;padding:48px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:40px;color:#64748b;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
`;

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [staffFilter, setStaffFilter] = useState("ALL");

  useEffect(() => {
    supabase
      .from("order_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setLoading(false);
      });
  }, []);

  const staffList = useMemo(() => {
    const set = new Set(orders.map(o => o.requested_by));
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "ALL") list = list.filter(o => o.status === statusFilter);
    if (staffFilter !== "ALL") list = list.filter(o => o.requested_by === staffFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.item_name || "").toLowerCase().includes(q) ||
        (o.vendor || "").toLowerCase().includes(q) ||
        (o.reference_number || "").toLowerCase().includes(q) ||
        (o.requested_by || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, staffFilter, search]);

  const totalOrders = orders.length;
  const totalReceived = orders.filter(o => o.status === "RECEIVED").length;
  const totalPending = orders.filter(o => o.status === "PENDING").length;
  const totalBackordered = orders.filter(o => o.status === "BACKORDERED").length;

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function formatTime(ts: string) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

          <div className="header">
            <div className="header-title">📋 Order History</div>
            <div className="header-sub">Complete timeline of all order requests and their status</div>
          </div>

          <div className="stats-row">
            <div className="stat">
              <div className="stat-val">{totalOrders}</div>
              <div className="stat-lbl">Total</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color:"#fcd34d" }}>{totalPending}</div>
              <div className="stat-lbl">Pending</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color:"#fca5a5" }}>{totalBackordered}</div>
              <div className="stat-lbl">Backordered</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color:"#6ee7b7" }}>{totalReceived}</div>
              <div className="stat-lbl">Received</div>
            </div>
          </div>

          <div className="controls">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, vendor, staff…" className="inp" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="inp inp-sel">
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ORDERED">Ordered</option>
              <option value="BACKORDERED">Backordered</option>
              <option value="RECEIVED">Received</option>
            </select>
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="inp inp-sel">
              <option value="ALL">All Staff</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="count">Showing {filtered.length} of {totalOrders} orders</div>

          {loading ? (
            <div className="loading">Loading order history…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No orders match your filters.</div>
          ) : (
            <div className="timeline">
              {filtered.map(order => (
                <div key={order.id} className="tl-item">
                  <div className={"tl-dot " + order.status} />
                  <div className={"tl-card " + order.status}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                      <div className="tl-name">{order.item_name}</div>
                      <span className={getBadgeClass(order.status)}>{order.status}</span>
                    </div>
                    <div className="tl-meta">
                      {order.vendor || "—"} · {order.reference_number ? `Ref: ${order.reference_number}` : "No ref"} · {order.unit || "—"}<br />
                      <strong style={{ color:"#f0f6ff" }}>Requested by: {order.requested_by}</strong> · {formatDate(order.created_at)}<br />
                      Qty Requested: <strong style={{ color:"#f0f6ff" }}>{order.qty_requested}</strong>
                      {order.qty_actual_ordered && order.qty_actual_ordered !== order.qty_requested && (
                        <span style={{ color:"#fcd34d" }}> → Actual Ordered: <strong>{order.qty_actual_ordered}</strong></span>
                      )}
                      {order.qty_actual_received && (
                        <span style={{ color:"#6ee7b7" }}> · Received: <strong>{order.qty_actual_received}</strong></span>
                      )}
                    </div>

                    <div className="timeline-steps">
                      <div className={"step done"}>
                        ✓ Requested {formatDate(order.created_at)}
                      </div>
                      {order.confirmed_at && (
                        <div className="step done">
                          → {order.status === "BACKORDERED" ? "🔴 Backordered" : "✓ Ordered"} {formatTime(order.confirmed_at)}
                          {order.confirmed_by && <span style={{ color:"#64748b" }}> by {order.confirmed_by}</span>}
                        </div>
                      )}
                      {order.expected_delivery_date && order.status !== "RECEIVED" && (
                        <div className="step active">
                          📅 Expected: {formatDate(order.expected_delivery_date + "T00:00:00")}
                        </div>
                      )}
                      {order.received_at && (
                        <div className="step done">
                          ✓ Received {formatTime(order.received_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
