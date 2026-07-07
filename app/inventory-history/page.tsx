"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type HistoryRow = { id: string; item_id: string; item_name: string; on_hand: number; changed_by: string; change_type: string; created_at: string; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;}
  .header-sub{font-size:12px;color:#64748b;margin-top:2px;}
  .search-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
  .row{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px 14px;margin-bottom:8px;}
  .row-name{font-size:13px;font-weight:700;color:#f0f6ff;}
  .row-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .badge{font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;}
  .badge-set{background:rgba(59,130,246,0.15);color:#93c5fd;}
  .badge-use{background:rgba(239,68,68,0.15);color:#fca5a5;}
  .badge-restock{background:rgba(16,185,129,0.15);color:#6ee7b7;}
  .badge-adjust{background:rgba(234,179,8,0.15);color:#fcd34d;}
`;

export default function InventoryHistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("inventory_history").select("*").order("created_at", { ascending: false }).limit(300).then(({ data }) => {
      if (data) setRows(data as HistoryRow[]);
      setLoading(false);
    });
  }, []);

  const filtered = rows.filter(r => r.item_name?.toLowerCase().includes(search.toLowerCase()));

  function badgeClass(type: string) {
    if (type === "SET") return "badge badge-set";
    if (type === "USE") return "badge badge-use";
    if (type === "RESTOCK") return "badge badge-restock";
    return "badge badge-adjust";
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="header">
            <div className="header-title">📜 Inventory History</div>
            <div className="header-sub">Permanent record of every count change, tied to the exact item — this can never be lost or confused by name matching again.</div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item name…" className="search-inp" />
          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#64748b"}}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#334155"}}>No history yet — this builds up automatically as you use the app.</div>
          ) : filtered.map(r => (
            <div key={r.id} className="row">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div>
                  <div className="row-name">{r.item_name}</div>
                  <div className="row-meta">On hand: <strong style={{color:"#f0f6ff"}}>{r.on_hand}</strong> · By {r.changed_by} · {formatTime(r.created_at)}</div>
                </div>
                <span className={badgeClass(r.change_type)}>{r.change_type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
