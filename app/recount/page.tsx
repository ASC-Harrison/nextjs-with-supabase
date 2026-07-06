"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

type Item = { id: string; name: string; vendor: string | null; category: string | null; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 80px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#ef4444,#f59e0b,#ef4444);}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .search-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
  .item-row{display:flex;align-items:center;gap:10px;background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px 14px;margin-bottom:8px;}
  .item-row.done{border-color:rgba(16,185,129,0.3);}
  .item-info{flex:1;min-width:0;}
  .item-name{font-size:13px;font-weight:700;color:#f0f6ff;word-break:break-word;line-height:1.3;}
  .item-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .count-inp{width:90px;border-radius:8px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:8px 10px;font-size:16px;font-weight:800;text-align:center;font-family:inherit;outline:none;flex-shrink:0;}
  .count-inp:focus{border-color:#3b82f6;}
  .save-bar{position:fixed;bottom:0;left:0;right:0;background:#162032;border-top:1px solid #1e3a5f;padding:12px 16px;display:flex;gap:10px;align-items:center;z-index:50;}
  .btn{border-radius:10px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-ac{background:#3b82f6;color:#fff;flex:1;}
  .btn-ac:disabled{opacity:0.4;cursor:not-allowed;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
`;

export default function RecountPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);

  useEffect(() => {
    async function load() {
      const { data: allItems } = await supabase.from("items").select("id,name,vendor,category").eq("is_active", true).order("name");
      const { data: stocked } = await supabase.from("storage_inventory").select("item_id").eq("storage_area_id", MAIN_SUPPLY_ID).gt("on_hand", 0);
      const stockedIds = new Set((stocked || []).map((s: any) => s.item_id));
      const needsRecount = (allItems || []).filter((i: any) => !stockedIds.has(i.id));
      setItems(needsRecount as Item[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const filledCount = Object.values(counts).filter(v => v.trim() !== "").length;

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    try {
      const updates = Object.entries(counts).filter(([, v]) => v.trim() !== "" && Number(v) > 0);
      if (updates.length === 0) { setMsg({type:"err", text:"Enter at least one count first."}); setSaving(false); return; }

      for (const [itemId, val] of updates) {
        const qty = Number(val);
        // Check if row exists
        const { data: existing } = await supabase.from("storage_inventory").select("item_id").eq("item_id", itemId).eq("storage_area_id", MAIN_SUPPLY_ID).maybeSingle();
        if (existing) {
          await supabase.from("storage_inventory").update({ on_hand: qty, updated_at: new Date().toISOString() }).eq("item_id", itemId).eq("storage_area_id", MAIN_SUPPLY_ID);
        } else {
          await supabase.from("storage_inventory").insert({ item_id: itemId, storage_area_id: MAIN_SUPPLY_ID, on_hand: qty, par_level: 0, low_level: 0 });
        }
      }

      // Resync building_totals for these items
      const ids = updates.map(([id]) => id);
      for (const id of ids) {
        await supabase.rpc("noop").catch(() => {}); // placeholder, real sync happens via trigger now
      }

      setMsg({type:"ok", text:`✅ Saved ${updates.length} recounts!`});
      setItems(prev => prev.filter(i => !ids.includes(i.id)));
      setCounts({});
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
            <div className="header-title">🔢 Recount Needed</div>
            <div className="header-sub">{items.length} items need a fresh count · type the real number you see on the shelf</div>
          </div>

          {msg && <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="search-inp" />

          <div className="count">Showing {filtered.length} of {items.length} · {filledCount} entered</div>

          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#64748b"}}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#334155"}}>{items.length === 0 ? "🎉 All items have counts! Nothing left to recount." : "No items match your search."}</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className={"item-row " + (counts[item.id]?.trim() ? "done" : "")}>
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">{item.vendor || "—"} · {item.category || "—"}</div>
                </div>
                <input
                  type="number"
                  min={0}
                  value={counts[item.id] ?? ""}
                  onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="0"
                  className="count-inp"
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="save-bar">
        <span style={{ fontSize:12, color:"#64748b" }}>{filledCount > 0 ? `${filledCount} ready to save` : "Enter counts above"}</span>
        <button onClick={saveAll} disabled={saving || filledCount === 0} className="btn btn-ac">
          {saving ? "Saving…" : `💾 Save ${filledCount} Counts`}
        </button>
      </div>
    </>
  );
}
