"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = { id: string; name: string; vendor: string | null; category: string | null; price: number | null; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 80px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .search-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
  .item-row{display:flex;align-items:center;gap:10px;background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px 14px;margin-bottom:8px;}
  .item-row.has-price{border-color:rgba(16,185,129,0.3);}
  .item-info{flex:1;min-width:0;}
  .item-name{font-size:13px;font-weight:700;color:#f0f6ff;word-break:break-word;line-height:1.3;}
  .item-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .price-inp{width:90px;border-radius:8px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:8px 10px;font-size:14px;font-weight:800;text-align:center;font-family:inherit;outline:none;flex-shrink:0;}
  .price-inp:focus{border-color:#3b82f6;}
  .save-bar{position:fixed;bottom:0;left:0;right:0;background:#162032;border-top:1px solid #1e3a5f;padding:12px 16px;display:flex;gap:10px;align-items:center;z-index:50;}
  .btn{border-radius:10px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;}
  .btn-ac{background:#3b82f6;color:#fff;flex:1;}
  .btn-ac:hover{background:#2563eb;}
  .btn-ac:disabled{opacity:0.4;cursor:not-allowed;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
  .filter-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
  .filter-btn{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
`;

export default function PriceEditorPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);

  useEffect(() => {
    supabase.from("items").select("id,name,vendor,category,price").eq("is_active", true).order("name").then(({ data }) => {
      if (data) {
        setItems(data as Item[]);
        const p: Record<string,string> = {};
        data.forEach((i: any) => { p[i.id] = i.price != null ? String(i.price) : ""; });
        setPrices(p);
      }
      setLoading(false);
    });
  }, []);

  const filtered = items.filter(i => {
    if (showUnpriced && (i.price != null && i.price > 0)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (i.name||"").toLowerCase().includes(q) || (i.vendor||"").toLowerCase().includes(q) || (i.category||"").toLowerCase().includes(q);
    }
    return true;
  });

  const pricedCount = items.filter(i => i.price != null && i.price > 0).length;
  const changedCount = Object.entries(prices).filter(([id, val]) => {
    const orig = items.find(i => i.id === id);
    if (!orig) return false;
    const origPrice = orig.price != null ? String(orig.price) : "";
    return val !== origPrice;
  }).length;

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    try {
      const updates = Object.entries(prices)
        .filter(([id, val]) => {
          const orig = items.find(i => i.id === id);
          if (!orig) return false;
          const origPrice = orig.price != null ? String(orig.price) : "";
          return val !== origPrice;
        })
        .map(([id, val]) => ({ id, price: val.trim() ? Number(val) : null }));

      if (updates.length === 0) { setMsg({ type:"ok", text:"No changes to save." }); setSaving(false); return; }

      for (const update of updates) {
        await supabase.from("items").update({ price: update.price }).eq("id", update.id);
      }

      // Update local state
      setItems(prev => prev.map(i => {
        const u = updates.find(u => u.id === i.id);
        return u ? { ...i, price: u.price } : i;
      }));

      setMsg({ type:"ok", text:`✅ Saved prices for ${updates.length} items!` });
    } catch (e:any) {
      setMsg({ type:"err", text: e?.message ?? "Failed to save" });
    } finally { setSaving(false); }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="header">
            <div className="header-title">💰 Price Editor</div>
            <div className="header-sub">{pricedCount} of {items.length} items have prices set</div>
          </div>

          {msg && <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, vendor, category…" className="search-inp" />

          <div className="filter-row">
            <button onClick={() => setShowUnpriced(false)} className={"filter-btn " + (!showUnpriced ? "on" : "off")}>All Items</button>
            <button onClick={() => setShowUnpriced(true)} className={"filter-btn " + (showUnpriced ? "on" : "off")}>No Price Only</button>
          </div>

          <div className="count">Showing {filtered.length} items · {changedCount} unsaved changes</div>

          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#64748b"}}>Loading items…</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className={"item-row " + (prices[item.id] ? "has-price" : "")}>
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">{item.vendor || "—"} · {item.category || "—"}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:13, color:"#64748b", fontWeight:700 }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prices[item.id] ?? ""}
                    onChange={e => setPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="0.00"
                    className="price-inp"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="save-bar">
        <span style={{ fontSize:12, color:"#64748b" }}>{changedCount > 0 ? `${changedCount} unsaved` : "All saved"}</span>
        <button onClick={saveAll} disabled={saving || changedCount === 0} className="btn btn-ac">
          {saving ? "Saving…" : `💾 Save All Prices`}
        </button>
      </div>
    </>
  );
}
