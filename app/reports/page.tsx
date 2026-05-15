"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LogRow = {
  id: string;
  created_at: string;
  staff: string;
  action: string;
  details: string | null;
  area_name: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .title{font-size:26px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:20px;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;}
  .card-title{font-size:16px;font-weight:900;color:#f0f6ff;letter-spacing:-0.3px;margin-bottom:16px;}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:16px;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;}
  .stat-val{font-size:30px;font-weight:900;color:#f0f6ff;letter-spacing:-1px;margin-top:4px;}
  .stat-sub{font-size:11px;color:#64748b;margin-top:2px;}
  .filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
  .inp{border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:10px 14px;font-size:13px;font-family:inherit;outline:none;transition:all 0.18s;}
  .inp:focus{border-color:#3b82f6;}
  .inp-sel{appearance:none;padding-right:32px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;}
  .bar-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e3a5f;}
  .bar-row:last-child{border-bottom:none;}
  .bar-label{font-size:12px;font-weight:600;color:#f0f6ff;width:180px;flex-shrink:0;word-break:break-word;line-height:1.4;}
  .bar-track{flex:1;background:#1e2d42;border-radius:4px;height:10px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#3b82f6,#60a5fa);}
  .bar-count{font-size:12px;font-weight:800;color:#60a5fa;width:40px;text-align:right;flex-shrink:0;}
  .tab-row{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;}
  .tab-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid;transition:all 0.18s;font-family:inherit;}
  .tab-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .tab-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .tab-btn.off:hover{color:#f0f6ff;}
  .empty{text-align:center;padding:32px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:32px;color:#64748b;font-size:13px;}
  .tx-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #1e3a5f;}
  .tx-row:last-child{border-bottom:none;}
  .tx-time{font-size:11px;color:#334155;flex-shrink:0;width:90px;}
  .tx-staff{font-size:12px;font-weight:700;color:#f0f6ff;flex-shrink:0;width:100px;word-break:break-word;}
  .tx-detail{font-size:11px;color:#94a3b8;word-break:break-word;line-height:1.5;}
  .tx-area{font-size:10px;color:#334155;margin-top:2px;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;}
  .badge-use{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .badge-rst{background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
`;

const RANGES = [
  { id: "7",  label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "all", label: "All time" },
];

const VIEWS = ["Overview", "Top Items", "By Staff", "By Area", "Cost", "Transactions"];

export default function ReportsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [view, setView] = useState("Overview");
  const [search, setSearch] = useState("");

  const [itemPrices, setItemPrices] = useState<Record<string,number>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [logsRes, pricesRes] = await Promise.all([
          supabase.from("audit_log").select("id,created_at,staff,action,details,area_name").order("created_at", { ascending: false }).limit(5000),
          supabase.from("items").select("id,name,price").not("price","is",null)
        ]);
        setLogs((logsRes.data as LogRow[]) ?? []);
        if (pricesRes.data) {
          const map: Record<string,number> = {};
          pricesRes.data.forEach((r:any) => { if (r.name && r.price) map[r.name] = r.price; });
          setItemPrices(map);
        }
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = logs.filter(l => l.action === "SUBMIT_TX");
    if (range !== "all") {
      const days = Number(range);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(l => new Date(l.created_at) >= cutoff);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.details||"").toLowerCase().includes(q) ||
        (l.staff||"").toLowerCase().includes(q) ||
        (l.area_name||"").toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, range, search]);

  // Parse item name from details string like "Mode=USE Qty=2 Item=Surgical Gloves Area=OR1"
  function parseDetail(details: string | null, key: string): string {
    if (!details) return "—";
    const match = details.match(new RegExp(`${key}=([^\\s]+(?:\\s+[^=\\s]+)*?)(?=\\s+\\w+=|$)`));
    return match ? match[1] : "—";
  }

  const costByItem = useMemo(() => {
    const map: Record<string,{count:number;cost:number}> = {};
    filtered.filter(l=>(l.details||"").includes("Mode=USE")).forEach(l => {
      const item = parseDetail(l.details, "Item");
      const qty = Number(parseDetail(l.details, "Qty")) || 1;
      const price = itemPrices[item] || 0;
      if (!map[item]) map[item] = {count:0,cost:0};
      map[item].count += qty;
      map[item].cost += price * qty;
    });
    return Object.entries(map).sort((a,b) => b[1].cost - a[1].cost).slice(0,15);
  }, [filtered, itemPrices]);

  const totalCost = useMemo(() => costByItem.reduce((sum,[,v])=>sum+v.cost,0), [costByItem]);
  const maxCost = Math.max(...costByItem.map(([,v])=>v.cost),1);

  const topItems = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => {
      const item = parseDetail(l.details, "Item");
      if (item !== "—") map[item] = (map[item] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  const byStaff = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => { map[l.staff] = (map[l.staff] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const byArea = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => {
      const area = l.area_name || parseDetail(l.details, "Area");
      if (area !== "—") map[area] = (map[area] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const useCount = filtered.filter(l => (l.details||"").includes("Mode=USE")).length;
  const restockCount = filtered.filter(l => (l.details||"").includes("Mode=RESTOCK")).length;
  const maxVal = Math.max(...topItems.map(([,v]) => v), 1);

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="title">Usage Reports</div>
          <div className="sub">Track item usage, staff activity, and trends over time.</div>

          {/* Range filter */}
          <div className="filter-row">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)} className={`tab-btn ${range === r.id ? "on" : "off"}`}>{r.label}</button>
            ))}
          </div>

          {loading ? <div className="loading">Loading reports…</div> : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat">
                  <div className="stat-lbl">Total Transactions</div>
                  <div className="stat-val">{filtered.length}</div>
                  <div className="stat-sub">USE + RESTOCK</div>
                </div>
                <div className="stat">
                  <div className="stat-lbl">Items Used</div>
                  <div className="stat-val" style={{color:"#fca5a5"}}>{useCount}</div>
                  <div className="stat-sub">pulled from stock</div>
                </div>
                <div className="stat">
                  <div className="stat-lbl">Restocks</div>
                  <div className="stat-val" style={{color:"#6ee7b7"}}>{restockCount}</div>
                  <div className="stat-sub">added to stock</div>
                </div>
                <div className="stat">
                  <div className="stat-lbl">Unique Items</div>
                  <div className="stat-val">{topItems.length}</div>
                  <div className="stat-sub">moved in period</div>
                </div>
              </div>

              {/* View tabs */}
              <div className="tab-row">
                {VIEWS.map(v => (
                  <button key={v} onClick={() => setView(v)} className={`tab-btn ${view === v ? "on" : "off"}`}>{v}</button>
                ))}
              </div>

              {/* Search */}
              {(view === "Transactions" || view === "Top Items") && (
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, staff, area…" className="inp" style={{width:"100%",marginBottom:16}} />
              )}

              {/* Overview */}
              {view === "Overview" && (
                <div className="card">
                  <div className="card-title">Top 5 Items</div>
                  {topItems.slice(0,5).map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <div className="bar-label">{name}</div>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${(count/maxVal)*100}%`}} /></div>
                      <div className="bar-count">{count}</div>
                    </div>
                  ))}
                  {topItems.length === 0 && <div className="empty">No transactions in this period.</div>}
                </div>
              )}

              {/* Top Items */}
              {view === "Top Items" && (
                <div className="card">
                  <div className="card-title">Most Used Items</div>
                  {topItems.map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <div className="bar-label">{name}</div>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${(count/maxVal)*100}%`}} /></div>
                      <div className="bar-count">{count}</div>
                    </div>
                  ))}
                  {topItems.length === 0 && <div className="empty">No transactions in this period.</div>}
                </div>
              )}

              {/* By Staff */}
              {view === "By Staff" && (
                <div className="card">
                  <div className="card-title">Transactions by Staff</div>
                  {byStaff.map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <div className="bar-label">{name}</div>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${(count/Math.max(...byStaff.map(([,v])=>v),1))*100}%`,background:"linear-gradient(90deg,#8b5cf6,#a78bfa)"}} /></div>
                      <div className="bar-count" style={{color:"#a78bfa"}}>{count}</div>
                    </div>
                  ))}
                  {byStaff.length === 0 && <div className="empty">No transactions in this period.</div>}
                </div>
              )}

              {/* By Area */}
              {view === "By Area" && (
                <div className="card">
                  <div className="card-title">Transactions by Area</div>
                  {byArea.map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <div className="bar-label">{name}</div>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${(count/Math.max(...byArea.map(([,v])=>v),1))*100}%`,background:"linear-gradient(90deg,#10b981,#6ee7b7)"}} /></div>
                      <div className="bar-count" style={{color:"#6ee7b7"}}>{count}</div>
                    </div>
                  ))}
                  {byArea.length === 0 && <div className="empty">No transactions in this period.</div>}
                </div>
              )}

              {/* Cost */}
              {view === "Cost" && (
                <>
                  <div className="stats-grid">
                    <div className="stat">
                      <div className="stat-lbl">Total Spend</div>
                      <div className="stat-val" style={{fontSize:22,color:"#fcd34d"}}>${totalCost.toFixed(2)}</div>
                      <div className="stat-sub">items with prices set</div>
                    </div>
                    <div className="stat">
                      <div className="stat-lbl">Items Tracked</div>
                      <div className="stat-val">{costByItem.length}</div>
                      <div className="stat-sub">have pricing data</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-title">Cost by Item</div>
                    {costByItem.length === 0 && <div className="empty">No pricing data yet. Add prices to items in the Totals tab.</div>}
                    {costByItem.map(([name,{count,cost}]) => (
                      <div key={name} className="bar-row">
                        <div className="bar-label">
                          <div>{name}</div>
                          <div style={{fontSize:10,color:"#64748b",marginTop:2}}>Qty used: {count}</div>
                        </div>
                        <div className="bar-track"><div className="bar-fill" style={{width:`${(cost/maxCost)*100}%`,background:"linear-gradient(90deg,#f59e0b,#fcd34d)"}} /></div>
                        <div className="bar-count" style={{color:"#fcd34d",width:60}}>${cost.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Transactions */}
              {view === "Transactions" && (
                <div className="card">
                  <div className="card-title">Transaction History ({filtered.length})</div>
                  {filtered.slice(0, 200).map(l => {
                    const isUse = (l.details||"").includes("Mode=USE");
                    return (
                      <div key={l.id} className="tx-row">
                        <div className="tx-time">{formatTime(l.created_at)}</div>
                        <div className="tx-staff">{l.staff}</div>
                        <div>
                          <span className={`badge ${isUse ? "badge-use" : "badge-rst"}`}>{isUse ? "USE" : "RESTOCK"}</span>
                          <div className="tx-detail" style={{marginTop:4}}>{parseDetail(l.details,"Item")} · Qty: {parseDetail(l.details,"Qty")}</div>
                          <div className="tx-area">{l.area_name || parseDetail(l.details,"Area")}</div>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && <div className="empty">No transactions in this period.</div>}
                  {filtered.length > 200 && <div style={{textAlign:"center",fontSize:11,color:"#334155",marginTop:12}}>Showing first 200. Use filters to narrow down.</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
