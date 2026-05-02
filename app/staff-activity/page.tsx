"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PresenceRow = {
  id: string;
  staff: string;
  last_seen: string;
  area_name: string | null;
  device_info: string | null;
};

type LogRow = {
  id: string;
  created_at: string;
  staff: string;
  action: string;
  details?: string | null;
  area_name?: string | null;
  device_info?: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  SUBMIT_TX:        "rgba(59,130,246,0.2)",
  UNDO_TX:          "rgba(245,158,11,0.2)",
  SCAN:             "rgba(139,92,246,0.2)",
  LOOKUP_FOUND:     "rgba(16,185,129,0.2)",
  LOOKUP_NOT_FOUND: "rgba(239,68,68,0.2)",
  UNLOCK:           "rgba(16,185,129,0.2)",
  LOCK:             "rgba(239,68,68,0.2)",
  ADD_ITEM:         "rgba(59,130,246,0.2)",
  TOTALS_SET:       "rgba(16,185,129,0.2)",
  TOTALS_ADJUST:    "rgba(245,158,11,0.2)",
  ITEM_STATUS_SAVE: "rgba(59,130,246,0.2)",
  CHANGE_LOCATION:  "rgba(59,130,246,0.2)",
};

const ACTION_TEXT: Record<string, string> = {
  SUBMIT_TX:        "#93c5fd",
  UNDO_TX:          "#fcd34d",
  SCAN:             "#c4b5fd",
  LOOKUP_FOUND:     "#6ee7b7",
  LOOKUP_NOT_FOUND: "#fca5a5",
  UNLOCK:           "#6ee7b7",
  LOCK:             "#fca5a5",
  ADD_ITEM:         "#93c5fd",
  TOTALS_SET:       "#6ee7b7",
  TOTALS_ADJUST:    "#fcd34d",
  ITEM_STATUS_SAVE: "#93c5fd",
  CHANGE_LOCATION:  "#93c5fd",
};

const CSS = `
  :root {
    --bg:#0a0f1e;--card:#162032;--surface:#1e2d42;--border:#1e3a5f;
    --border2:#162032;--ac:#3b82f6;--ac-bright:#60a5fa;--ac-dim:rgba(59,130,246,0.12);
    --border-ac:rgba(59,130,246,0.4);--text:#f0f6ff;--text2:#94a3b8;--text3:#64748b;--text4:#334155;
    --ok:#10b981;--ok-dim:rgba(16,185,129,0.1);--ok-border:rgba(16,185,129,0.3);
    --danger:#ef4444;--danger-dim:rgba(239,68,68,0.1);--danger-border:rgba(239,68,68,0.3);
    --warn-dim:rgba(245,158,11,0.1);--warn-border:rgba(245,158,11,0.3);
    --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-full:9999px;
    --shadow-md:0 4px 12px rgba(0,0,0,0.4);--t:all 0.18s cubic-bezier(0.4,0,0.2,1);
  }
  *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:var(--bg);padding:0 16px 60px;}
  .wrap{max-width:900px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 16px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;margin-top:16px;margin-bottom:16px;transition:var(--t);font-family:inherit;}
  .back-btn:hover{color:var(--text);border-color:var(--border-ac);}
  .page-title{font-size:26px;font-weight:900;color:var(--text);letter-spacing:-0.8px;}
  .page-sub{font-size:13px;color:var(--text3);margin-top:4px;margin-bottom:20px;}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;}
  .stat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px;}
  .stat-lbl{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;}
  .stat-val{font-size:28px;font-weight:900;color:var(--text);margin-top:4px;letter-spacing:-1px;}
  .stat-sub{font-size:11px;color:var(--text3);margin-top:2px;}
  .controls{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
  .inp{border-radius:var(--r-md);border:1px solid var(--border);background:#111827;color:var(--text);padding:10px 14px;font-size:13px;font-family:inherit;outline:none;transition:var(--t);}
  .inp:focus{border-color:var(--ac);}
  .inp-sel{appearance:none;padding-right:32px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;}
  .btn{border-radius:var(--r-md);padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:var(--t);font-family:inherit;display:inline-flex;align-items:center;gap:6px;}
  .btn-ac{background:var(--ac);color:#fff;}
  .btn-ac:hover{background:#2563eb;}
  .btn-gh{background:var(--surface);color:var(--text2);border:1px solid var(--border);}
  .btn-gh:hover{color:var(--text);border-color:var(--border-ac);}
  .staff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:24px;}
  .staff-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;cursor:pointer;transition:var(--t);}
  .staff-card:hover{border-color:var(--border-ac);transform:translateY(-1px);}
  .staff-card.active-sel{border-color:var(--ac);background:#162032;}
  .staff-name{font-size:16px;font-weight:800;color:var(--text);}
  .staff-last{font-size:11px;color:var(--text3);margin-top:4px;}
  .staff-count{font-size:12px;color:var(--ac-bright);margin-top:6px;font-weight:700;}
  .activity-dot{width:8px;height:8px;border-radius:50%;background:var(--ok);display:inline-block;margin-right:6px;animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  .log-table{background:var(--card);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;}
  .log-header{display:grid;grid-template-columns:140px 120px 140px 1fr;gap:0;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border);padding:10px 16px;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;}
  .log-row{display:grid;grid-template-columns:140px 120px 140px 1fr;gap:0;padding:12px 16px;border-bottom:1px solid var(--border2);transition:background 0.1s;align-items:start;}
  .log-row:hover{background:rgba(255,255,255,0.02);}
  .log-row:last-child{border-bottom:none;}
  .log-time{font-size:11px;color:var(--text3);}
  .log-staff{font-size:12px;font-weight:700;color:var(--text);}
  .log-action{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-full);font-size:10px;font-weight:800;letter-spacing:0.3px;}
  .log-details{font-size:11px;color:var(--text2);word-break:break-word;line-height:1.5;}
  .empty{text-align:center;padding:48px 20px;color:var(--text3);font-size:14px;}
  .section-title{font-size:15px;font-weight:800;color:var(--text);margin-bottom:12px;letter-spacing:-0.3px;}
  .divider{height:1px;background:var(--border);margin:24px 0;}
  .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:var(--r-full);font-size:10px;font-weight:800;}
  .loading{text-align:center;padding:40px;color:var(--text3);font-size:14px;}
  @media(max-width:640px){
    .log-header{grid-template-columns:100px 90px 1fr;}
    .log-row{grid-template-columns:100px 90px 1fr;}
    .log-header>*:nth-child(3),.log-row>*:nth-child(3){display:none;}
  }
`;

export default function StaffActivityPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStaff, setFilterStaff] = useState("ALL");
  const [filterAction, setFilterAction] = useState("ALL");
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [presence, setPresence] = useState<PresenceRow[]>([]);

  async function loadPresence() {
    try {
      const { data } = await supabase
        .from("staff_presence")
        .select("id,staff,last_seen,area_name,device_info")
        .order("last_seen", { ascending: false });
      setPresence((data as PresenceRow[]) ?? []);
    } catch {}
  }

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,created_at,staff,action,details,area_name,device_info")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!error && data) setLogs(data as LogRow[]);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadLogs();
    loadPresence();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { loadLogs(); loadPresence(); }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const staffList = useMemo(() => {
    const map: Record<string, { count: number; last: string; recentAction: string }> = {};
    logs.forEach((l) => {
      if (!map[l.staff]) map[l.staff] = { count: 0, last: l.created_at, recentAction: l.action };
      map[l.staff].count++;
      if (l.created_at > map[l.staff].last) {
        map[l.staff].last = l.created_at;
        map[l.staff].recentAction = l.action;
      }
    });
    return Object.entries(map).sort((a, b) => b[1].last.localeCompare(a[1].last));
  }, [logs]);

  const actionList = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return ["ALL", ...Array.from(set).sort()];
  }, [logs]);

  const staffNameList = useMemo(() => {
    return ["ALL", ...staffList.map(([name]) => name)];
  }, [staffList]);

  const filtered = useMemo(() => {
    let list = logs;
    if (selectedStaff) list = list.filter((l) => l.staff === selectedStaff);
    else if (filterStaff !== "ALL") list = list.filter((l) => l.staff === filterStaff);
    if (filterAction !== "ALL") list = list.filter((l) => l.action === filterAction);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.staff.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.details || "").toLowerCase().includes(q) ||
        (l.area_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, filterStaff, filterAction, search, selectedStaff]);

  const isRecent = (ts: string) => {
    return Date.now() - new Date(ts).getTime() < 30 * 60 * 1000; // 30 min
  };

  const totalTx = logs.filter((l) => l.action === "SUBMIT_TX").length;
  const todayLogs = logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString());
  const activeStaff = staffList.filter(([, v]) => isRecent(v.last));

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>

          <div className="page-title">Staff Activity</div>
          <div className="page-sub">Real-time view of all staff actions across all devices · Auto-refreshes every 15 seconds</div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-lbl">Total Events</div>
              <div className="stat-val">{logs.length}</div>
              <div className="stat-sub">all time</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Today</div>
              <div className="stat-val">{todayLogs.length}</div>
              <div className="stat-sub">events today</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Transactions</div>
              <div className="stat-val">{totalTx}</div>
              <div className="stat-sub">USE + RESTOCK</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Active Now</div>
              <div className="stat-val" style={{ color: activeStaff.length > 0 ? "#10b981" : "var(--text)" }}>{activeStaff.length}</div>
              <div className="stat-sub">within 30 min</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Staff Total</div>
              <div className="stat-val">{staffList.length}</div>
              <div className="stat-sub">unique staff</div>
            </div>
          </div>

          {/* Live Presence */}
          <div className="section-title">🟢 Currently Online</div>
          {presence.length === 0 ? (
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>Nobody is currently in the app.</div>
          ) : (
            <div className="staff-grid" style={{marginBottom:20}}>
              {presence.map(p => {
                const diffMin = Math.floor((Date.now() - new Date(p.last_seen).getTime()) / 60000);
                const isOnline = diffMin < 2;
                const isIdle = diffMin >= 2 && diffMin < 10;
                return (
                  <div key={p.id} className="staff-card" style={{border:`1px solid ${isOnline?"rgba(16,185,129,0.4)":isIdle?"rgba(245,158,11,0.3)":"var(--border)"}`}}>
                    <div className="staff-name">
                      <span style={{width:8,height:8,borderRadius:"50%",background:isOnline?"#10b981":isIdle?"#f59e0b":"#475569",display:"inline-block",marginRight:6}} />
                      {p.staff}
                    </div>
                    <div className="staff-last">{isOnline?"Active now":isIdle?`Idle ${diffMin}m`:`Last seen ${diffMin}m ago`}</div>
                    {p.area_name && <div className="staff-last">📍 {p.area_name}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="divider" />
          {staffList.length > 0 && (
            <>
              <div className="section-title">Staff Overview</div>
              <div className="staff-grid">
                {staffList.map(([name, info]) => (
                  <div
                    key={name}
                    className={`staff-card ${selectedStaff === name ? "active-sel" : ""}`}
                    onClick={() => setSelectedStaff(selectedStaff === name ? null : name)}
                  >
                    <div className="staff-name">
                      {isRecent(info.last) && <span className="activity-dot" />}
                      {name}
                    </div>
                    <div className="staff-last">Last seen: {formatTime(info.last)}</div>
                    <div className="staff-last">Last action: {info.recentAction}</div>
                    <div className="staff-count">{info.count} total actions</div>
                  </div>
                ))}
              </div>
              {selectedStaff && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--ac-bright)", fontWeight: 700 }}>Filtering by: {selectedStaff}</span>
                  <button onClick={() => setSelectedStaff(null)} style={{ marginLeft: 12, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text3)", padding: "3px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Clear</button>
                </div>
              )}
            </>
          )}

          <div className="divider" />

          {/* Controls */}
          <div className="controls">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff, action, details…"
              className="inp"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select value={filterStaff} onChange={(e) => { setFilterStaff(e.target.value); setSelectedStaff(null); }} className="inp inp-sel">
              {staffNameList.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Staff" : s}</option>)}
            </select>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="inp inp-sel">
              {actionList.map((a) => <option key={a} value={a}>{a === "ALL" ? "All Actions" : a}</option>)}
            </select>
            <button onClick={loadLogs} className="btn btn-ac">Refresh</button>
            <button onClick={() => setAutoRefresh((v) => !v)} className="btn btn-gh">
              {autoRefresh ? "⏸ Auto" : "▶ Auto"}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
            Showing {filtered.length} of {logs.length} events
          </div>

          {/* Log Table */}
          {loading ? (
            <div className="loading">Loading activity…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {logs.length === 0
                ? "No activity logged yet. Activity will appear here once staff start using the app."
                : "No events match your filters."}
            </div>
          ) : (
            <div className="log-table">
              <div className="log-header">
                <div>Time</div>
                <div>Staff</div>
                <div>Action</div>
                <div>Details</div>
              </div>
              {filtered.slice(0, 500).map((row) => (
                <div key={row.id} className="log-row">
                  <div className="log-time">{formatTime(row.created_at)}</div>
                  <div className="log-staff">{row.staff}</div>
                  <div>
                    <span
                      className="log-action"
                      style={{
                        background: ACTION_COLORS[row.action] ?? "rgba(100,116,139,0.2)",
                        color: ACTION_TEXT[row.action] ?? "#94a3b8",
                        border: `1px solid ${ACTION_TEXT[row.action] ?? "#94a3b8"}33`,
                      }}
                    >
                      {row.action}
                    </span>
                  </div>
                  <div className="log-details">
                    {row.details && <div>{row.details}</div>}
                    {row.area_name && <div style={{ color: "var(--text3)", marginTop: 2 }}>Area: {row.area_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > 500 && (
            <div style={{ textAlign: "center", padding: "16px", fontSize: 12, color: "var(--text3)" }}>
              Showing first 500 results. Use filters to narrow down.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
