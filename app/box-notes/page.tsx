"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = { id: string; name: string; unit: string | null; vendor: string | null; alert_note: string | null; notes: string | null; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 80px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#f59e0b,#fcd34d,#f59e0b);}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .search-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
  .item-row{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px 14px;margin-bottom:8px;}
  .item-row.has-note{border-color:rgba(16,185,129,0.3);}
  .item-name{font-size:13px;font-weight:700;color:#f0f6ff;word-break:break-word;}
  .item-meta{font-size:11px;color:#64748b;margin-top:2px;margin-bottom:8px;}
  .note-inp{width:100%;border-radius:8px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:8px 10px;font-size:12px;font-family:inherit;outline:none;}
  .save-bar{position:fixed;bottom:0;left:0;right:0;background:#162032;border-top:1px solid #1e3a5f;padding:12px 16px;display:flex;gap:10px;align-items:center;z-index:50;}
  .btn{border-radius:10px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-ac{background:#3b82f6;color:#fff;flex:1;}
  .btn-ac:disabled{opacity:0.4;cursor:not-allowed;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
  .filter-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
  .filter-btn{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;}
  .filter-btn.on{background:#f59e0b;color:#000;border-color:#f59e0b;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
`;

export default function BoxNotesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);

  useEffect(() => {
    // Catch every variation: BX, Bx, bx, Case, case
    supabase
      .from("items")
      .select("id,name,unit,vendor,alert_note,notes")
      .eq("is_active", true)
      .or("unit.ilike.%bx%,unit.ilike.%case%,unit.ilike.%box%")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setItems(data as Item[]);
          const n: Record<string,string> = {};
          data.forEach((i: any) => { n[i.id] = i.alert_note || i.notes || ""; });
          setNotes(n);
        }
        setLoading(false);
      });
  }, []);

  const filtered = items.filter(i => {
    if (showEmpty && notes[i.id]?.trim()) return false;
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const filledCount = items.filter(i => notes[i.id]?.trim()).length;
  const changedCount = items.filter(i => (notes[i.id] || "") !== (i.alert_note || "")).length;

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    try {
      const updates = items.filter(i => (notes[i.id] || "") !== (i.alert_note || ""));
      if (updates.length === 0) { setMsg({type:"ok", text:"No changes to save."}); setSaving(false); return; }

      let failed = 0;
      for (const item of updates) {
        const res = await fetch("/api/building-inventory/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.id, action: "SAVE_PRICE_NOTE", alert_note: notes[item.id] || null }),
        });
        const json = await res.json();
        if (!json.ok) failed++;
      }

      setItems(prev => prev.map(i => ({ ...i, alert_note: notes[i.id] || null })));
      setMsg(failed > 0 ? {type:"err", text:`Saved with ${failed} failures.`} : {type:"ok", text:`✅ Saved ${updates.length} notes!`});
    } catch(e:any) {
      setMsg({type:"err", text: e?.message ?? "Failed to save"});
    }
    setSaving(false);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="header">
            <div className="header-title">📦 Box Contents Notes</div>
            <div className="header-sub">{items.length} boxed items · {filledCount} have notes</div>
          </div>

          {msg && <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="search-inp" />

          <div className="filter-row">
            <button onClick={() => setShowEmpty(false)} className={"filter-btn " + (!showEmpty ? "on" : "off")}>All Boxed Items</button>
            <button onClick={() => setShowEmpty(true)} className={"filter-btn " + (showEmpty ? "on" : "off")}>No Note Yet</button>
          </div>

          <div className="count">Showing {filtered.length} of {items.length} · {changedCount} unsaved changes</div>

          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#64748b"}}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#334155"}}>{items.length === 0 ? "No boxed items found." : "All boxed items have notes! 🎉"}</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className={"item-row " + (notes[item.id]?.trim() ? "has-note" : "")}>
                <div className="item-name">{item.name}</div>
                <div className="item-meta">{item.vendor || "—"} · Unit: {item.unit}</div>
                <input
                  value={notes[item.id] ?? ""}
                  onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="e.g. Our box = 15 units. Order 2 vendor boxes (30ct) to refill."
                  className="note-inp"
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="save-bar">
        <span style={{ fontSize:12, color:"#64748b" }}>{changedCount > 0 ? `${changedCount} unsaved` : "All saved"}</span>
        <button onClick={saveAll} disabled={saving || changedCount === 0} className="btn btn-ac">
          {saving ? "Saving…" : `💾 Save All (${changedCount})`}
        </button>
      </div>
    </>
  );
}
