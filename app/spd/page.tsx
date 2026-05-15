"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = {
  item_id: string;
  item_name: string;
  storage_area_name: string;
  storage_area_id: string;
  on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  vendor: string | null;
  category: string | null;
  reference_number: string | null;
  item_number?: string | null;
  order_status: string | null;
  backordered: boolean | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);}
  .header-title{font-size:24px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px;text-align:center;}
  .stat-val{font-size:22px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;}
  .inp{border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:10px 14px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:200px;}
  .inp-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:32px;}
  .filter-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;transition:all 0.18s;white-space:nowrap;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .section-title{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin:16px 0 8px;display:flex;align-items:center;justify-content:space-between;}
  .item-card{background:#162032;border-radius:12px;border:1px solid #1e3a5f;padding:12px 14px;margin-bottom:8px;position:relative;overflow:hidden;}
  .item-card.low{border-color:rgba(239,68,68,0.4);}
  .item-card.low::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#ef4444;}
  .item-card.ok::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#10b981;}
  .item-name{font-size:13px;font-weight:800;color:#f0f6ff;word-break:break-word;line-height:1.4;}
  .item-meta{font-size:11px;color:#64748b;margin-top:3px;line-height:1.5;}
  .oh-badge{border-radius:8px;padding:8px 12px;text-align:center;flex-shrink:0;margin-left:10px;}
  .oh-badge.low{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);}
  .oh-badge.ok{background:#1e2d42;border:1px solid #1e3a5f;}
  .oh-num{font-size:20px;font-weight:900;letter-spacing:-1px;line-height:1;}
  .oh-num.low{color:#ef4444;}
  .oh-num.ok{color:#f0f6ff;}
  .oh-unit{font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;margin-top:1px;}
  .area-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.2);margin-top:4px;}
  .badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:9999px;font-size:9px;font-weight:800;margin-left:4px;}
  .pills{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;}
  .pill{background:#111827;border:1px solid #1e3a5f;border-radius:6px;padding:4px 8px;font-size:10px;color:#64748b;font-weight:700;}
  .pill span{color:#f0f6ff;margin-left:2px;}
  .empty{text-align:center;padding:48px 20px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:40px;color:#64748b;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
  .read-only-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:9999px;padding:4px 12px;font-size:11px;font-weight:700;color:#6ee7b7;margin-top:8px;}
`;

export default function SPDPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);

  const SPD_AREA_ID = "ed062f99-290a-4ac4-87ea-519b6e34fcbc";

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("storage_inventory_area_view")
        .select("item_id,item_name,storage_area_name,storage_area_id,on_hand,par_level,low_level,unit,vendor,category,reference_number,order_status,backordered")
        .eq("storage_area_id", SPD_AREA_ID)
        .gt("par_level", 0)
        .order("item_name", { ascending: true });

      if (data) {
        // Fetch item numbers separately
        const itemIds = data.map((i: any) => i.item_id);
        const { data: itemData } = await supabase
          .from("items")
          .select("id, item_number")
          .in("id", itemIds);

        const itemNumMap: Record<string, string | null> = {};
        if (itemData) itemData.forEach((i: any) => { itemNumMap[i.id] = i.item_number; });

        const merged = data.map((i: any) => ({ ...i, item_number: itemNumMap[i.item_id] ?? null }));
        setItems(merged as Item[]);
        const uniqueAreas = Array.from(new Set(merged.map((i: any) => i.storage_area_name))).sort() as string[];
        setAreas(uniqueAreas);
      }
    } catch {}
    finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    let list = items;
    if (areaFilter !== "ALL") list = list.filter(i => i.storage_area_name === areaFilter);
    if (showLowOnly) list = list.filter(i => (i.low_level ?? 0) > 0 && (i.on_hand ?? 0) <= (i.low_level ?? 0));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.item_name || "").toLowerCase().includes(q) ||
        (i.vendor || "").toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.reference_number || "").toLowerCase().includes(q) ||
        (i.storage_area_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, areaFilter, showLowOnly, search]);

  const lowCount = items.filter(i => (i.low_level ?? 0) > 0 && (i.on_hand ?? 0) <= (i.low_level ?? 0)).length;
  const okCount = items.length - lowCount;

  // Group by area
  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    filtered.forEach(item => {
      if (!map[item.storage_area_name]) map[item.storage_area_name] = [];
      map[item.storage_area_name].push(item);
    });
    return map;
  }, [filtered]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>

          <div className="header">
            <div className="header-title">SPD Inventory View</div>
            <div className="header-sub">Sterile Processing Department inventory</div>
          </div>

          <div className="stats-row">
            <div className="stat">
              <div className="stat-val">{items.length}</div>
              <div className="stat-lbl">Total Items</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color:"#fca5a5" }}>{lowCount}</div>
              <div className="stat-lbl">Low Stock</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color:"#6ee7b7" }}>{okCount}</div>
              <div className="stat-lbl">OK</div>
            </div>
            <div className="stat">
              <div className="stat-val">{areas.length}</div>
              <div className="stat-lbl">Areas</div>
            </div>
          </div>

          <div className="controls">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, vendor, area, ref #…" className="inp" />
            <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="inp inp-sel" style={{ flex:"none", width:"auto" }}>
              <option value="ALL">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <button onClick={() => setShowLowOnly(false)} className={"filter-btn " + (!showLowOnly ? "on" : "off")}>All Items</button>
            <button onClick={() => setShowLowOnly(true)} className={"filter-btn " + (showLowOnly ? "on" : "off")}>🔴 Low Only</button>
            <button onClick={loadItems} className="filter-btn off">⟳ Refresh</button>
          </div>

          <div className="count">Showing {filtered.length} of {items.length} items</div>

          {loading ? (
            <div className="loading">Loading SPD inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {items.length === 0
                ? "No items in SPD yet. Go to Add / Manage Items → Add to Area and assign items to the SPD area."
                : "No items match your filter."}
            </div>
          ) : (
            filtered.map(item => {
              const oh = item.on_hand ?? 0;
              const par = item.par_level ?? 0;
              const low = item.low_level ?? 0;
              const isLow = low > 0 && oh <= low;
              return (
                <div key={item.item_id} className={"item-card " + (isLow ? "low" : "ok")}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div className="item-name">{item.item_name}</div>
                      <div className="item-meta">
                        {item.vendor || "—"} · {item.category || "—"}
                        {item.reference_number ? ` · Ref: ${item.reference_number}` : ""}
                        {item.item_number ? ` · Item#: ${item.item_number}` : ""}
                      </div>
                      <div className="pills">
                        <div className="pill">PAR <span>{par}</span></div>
                        <div className="pill">LOW <span style={{ color: low === 0 ? "#fcd34d" : "#f0f6ff" }}>{low}</span></div>
                        {item.unit && <div className="pill">UNIT <span>{item.unit}</span></div>}
                        {item.order_status && item.order_status !== "IN STOCK" && (
                          <div className="pill" style={{ borderColor:"rgba(59,130,246,0.3)", color:"#93c5fd" }}>{item.order_status}</div>
                        )}
                        {item.backordered && (
                          <div className="pill" style={{ borderColor:"rgba(239,68,68,0.3)", color:"#fca5a5" }}>BACKORDERED</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                      <div className={"oh-badge " + (isLow ? "low" : "ok")}>
                        <div className={"oh-num " + (isLow ? "low" : "ok")}>{oh}</div>
                        <div className="oh-unit">on hand</div>
                      </div>
                      <button
                        onClick={async () => {
                          if(!confirm(`Remove "${item.item_name}" from SPD?`)) return;
                          try {
                            await fetch("/api/items/add-to-area", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                storage_area_id: "ed062f99-290a-4ac4-87ea-519b6e34fcbc",
                                item_id: item.item_id,
                                on_hand: 0,
                                par_level: 0,
                                low_level: 0,
                              }),
                            });
                            setItems(prev => prev.filter(i => i.item_id !== item.item_id));
                          } catch {}
                        }}
                        style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:6, color:"#fca5a5", padding:"3px 8px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:700, whiteSpace:"nowrap" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
