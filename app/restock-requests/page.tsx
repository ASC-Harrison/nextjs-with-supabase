"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Request = {
  id: string;
  item_id: string;
  item_name: string;
  requested_by: string;
  requested_from: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 0 60px;}
  .header{background:linear-gradient(135deg,#162032,#111827);border-bottom:1px solid #1e3a5f;padding:16px;position:sticky;top:0;z-index:40;}
  .header-top{display:flex;align-items:center;justify-content:space-between;max-width:700px;margin:0 auto;}
  .header-title{font-size:20px;font-weight:900;color:#f0f6ff;}
  .back-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#94a3b8;cursor:pointer;font-family:inherit;}
  .wrap{max-width:700px;margin:0 auto;padding:16px;}
  .stats-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center;}
  .stat-val{font-size:24px;font-weight:900;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-top:2px;}
  .req-card{background:#162032;border:1px solid rgba(168,85,247,0.3);border-radius:14px;padding:14px;margin-bottom:10px;}
  .req-card.done{border-color:rgba(16,185,129,0.3);opacity:0.6;}
  .req-name{font-size:14px;font-weight:800;color:#f0f6ff;margin-bottom:4px;}
  .req-meta{font-size:11px;color:#64748b;line-height:1.6;}
  .btn{border-radius:10px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-green{background:rgba(16,185,129,0.2);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .empty{text-align:center;padding:48px;color:#334155;font-size:13px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .skel{animation:pulse 1.5s infinite;background:#162032;border-radius:10px;}
`;

export default function RestockRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffName, setStaffName] = useState("Admin");
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      if(data.session?.user) setStaffName(data.session.user.user_metadata?.full_name || data.session.user.email || "Admin");
    });
    loadRequests();

    // Real-time updates
    const channel = supabase
      .channel("restock_requests_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restock_requests" }, () => {
        loadRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadRequests() {
    const { data } = await supabase.from("restock_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setRequests(data as Request[]);
    setLoading(false);
  }

  async function markResolved(id: string) {
    setResolving(id);
    await supabase.from("restock_requests").update({
      status: "RESTOCKED",
      resolved_at: new Date().toISOString(),
      resolved_by: staffName,
    }).eq("id", id);
    await loadRequests();
    setResolving(null);
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  const pending = requests.filter(r => r.status === "PENDING");
  const resolved = requests.filter(r => r.status === "RESTOCKED");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div className="header-title">🔄 Restock Requests</div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
        </div>

        <div className="wrap">
          <div className="stats-row">
            <div className="stat">
              <div className="stat-val" style={{color:"#d8b4fe"}}>{pending.length}</div>
              <div className="stat-lbl">Needs Restocking</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{color:"#6ee7b7"}}>{resolved.length}</div>
              <div className="stat-lbl">Completed</div>
            </div>
          </div>

          {loading ? (
            [1,2,3].map(i => <div key={i} className="skel" style={{height:90,marginBottom:10}} />)
          ) : pending.length === 0 && resolved.length === 0 ? (
            <div className="empty">No restock requests yet.</div>
          ) : (
            <>
              {pending.length > 0 && (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:"#d8b4fe",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Needs Restocking ({pending.length})</div>
                  {pending.map(r => (
                    <div key={r.id} className="req-card">
                      <div className="req-name">{r.item_name}</div>
                      <div className="req-meta">
                        Requested by {r.requested_by} from {r.requested_from}<br/>
                        {formatTime(r.created_at)}
                      </div>
                      <button onClick={() => markResolved(r.id)} disabled={resolving===r.id} className="btn btn-green" style={{marginTop:10}}>
                        {resolving===r.id ? "Marking…" : "✅ Restocked"}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {resolved.length > 0 && (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginTop:20,marginBottom:10}}>Completed ({resolved.length})</div>
                  {resolved.slice(0,20).map(r => (
                    <div key={r.id} className="req-card done">
                      <div className="req-name">{r.item_name}</div>
                      <div className="req-meta">
                        Requested by {r.requested_by} · Restocked by {r.resolved_by}<br/>
                        {r.resolved_at ? formatTime(r.resolved_at) : ""}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
