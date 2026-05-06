"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AreaItem = {
  item_id: string;
  item_name: string;
  on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  vendor: string | null;
  category: string | null;
  reference_number: string | null;
  order_status: string | null;
  backordered: boolean | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:600px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:4px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);}
  .area-name{font-size:24px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:4px;}
  .area-sub{font-size:12px;color:#64748b;}
  .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center;}
  .stat-val{font-size:24px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .search-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
  .filter-row{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
  .filter-btn{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;transition:all 0.18s;}
  .filter-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .filter-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .item-card{background:#162032;border-radius:14px;border:1px solid #1e3a5f;padding:14px;margin-bottom:10px;position:relative;overflow:hidden;transition:all 0.18s;}
  .item-card.low{border-color:rgba(239,68,68,0.4);}
  .item-card.low::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#ef4444;border-radius:14px 0 0 14px;}
  .item-card.ok::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#10b981;border-radius:14px 0 0 14px;}
  .item-name{font-size:14px;font-weight:800;color:#f0f6ff;word-break:break-word;line-height:1.4;}
  .item-meta{font-size:11px;color:#64748b;margin-top:3px;line-height:1.5;}
  .oh-badge{border-radius:10px;padding:10px 14px;text-align:center;flex-shrink:0;margin-left:12px;}
  .oh-badge.low{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);}
  .oh-badge.ok{background:#1e2d42;border:1px solid #1e3a5f;}
  .oh-num{font-size:22px;font-weight:900;letter-spacing:-1px;line-height:1;}
  .oh-num.low{color:#ef4444;}
  .oh-num.ok{color:#f0f6ff;}
  .oh-unit{font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;margin-top:2px;}
  .counts-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px;}
  .count-pill{background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:6px;text-align:center;}
  .count-lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;}
  .count-val{font-size:13px;font-weight:800;color:#f0f6ff;margin-top:2px;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:800;}
  .empty{text-align:center;padding:48px 20px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:40px;color:#64748b;}
  .refresh-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;color:#94a3b8;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;}
`;

export default function AreaViewPage() {
  const router = useRouter();
  const params = useParams();
  const areaId = params?.id as string;

  const [areaName, setAreaName] = useState("");
  const [items, setItems] = useState<AreaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);

  useEffect(() => {
    if (!areaId) return;
    loadArea();
  }, [areaId]);

  async function loadArea() {
    setLoading(true);
    try {
      // Get area name
      const { data: areaData } = await supabase
        .from("storage_areas")
        .select("name")
        .eq("id", areaId)
        .single();
      if (areaData) setAreaName(areaData.name);

      // Get items in this area
      const { data } = await supabase
        .from("storage_inventory_area_view")
        .select("item_id,item_name,on_hand,par_level,low_level,unit,vendor,category,reference_number,order_status,backordered")
        .eq("storage_area_id", areaId)
        .gt("par_level", 0)
        .order("item_name", { ascending: true });

      setItems((data as AreaItem[]) ?? []);
    } catch {}
    finally { setLoading(false); }
  }

  const filtered = items.filter(item => {
    const isLow = (item.low_level ?? 0) > 0 && (item.on_hand ?? 0) <= (item.low_level ?? 0);
    if (showLowOnly && !isLow) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (item.item_name || "").toLowerCase().includes(q) ||
        (item.vendor || "").toLowerCase().includes(q) ||
        (item.reference_number || "").toLowerCase().includes(q);
    }
    return true;
  });

  const lowCount = items.filter(i => (i.low_level ?? 0) > 0 && (i.on_hand ?? 0) <= (i.low_level ?? 0)).length;
  const totalItems = items.length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>

          <div className="header">
            <div className="area-name">{areaName || "Loading…"}</div>
            <div className="area-sub">Storage area inventory view</div>
          </div>

          <div className="stats-row">
            <div className="stat">
              <div className="stat-val">{totalItems}</div>
              <div className="stat-lbl">Items</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: lowCount > 0 ? "#fca5a5" : "#6ee7b7" }}>{lowCount}</div>
              <div className="stat-lbl">Low Stock</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: "#6ee7b7" }}>{totalItems - lowCount}</div>
              <div className="stat-lbl">OK</div>
            </div>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items, vendor, ref #…"
            className="search-inp"
          />

          <div className="filter-row">
            <button onClick={() => setShowLowOnly(false)} className={"filter-btn " + (!showLowOnly ? "on" : "off")}>All Items</button>
            <button onClick={() => setShowLowOnly(true)} className={"filter-btn " + (showLowOnly ? "on" : "off")}>🔴 Low Only</button>
            <button onClick={loadArea} className="refresh-btn">⟳ Refresh</button>
          </div>

          {loading ? (
            <div className="loading">Loading items…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {items.length === 0 ? "No items set up in this area yet." : "No items match your filter."}
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
                        {item.reference_number ? ` · ${item.reference_number}` : ""}
                      </div>
                      {(item.order_status && item.order_status !== "IN STOCK") && (
                        <div style={{ marginTop:4 }}>
                          <span className="badge" style={{ background:"rgba(59,130,246,0.15)", color:"#93c5fd", border:"1px solid rgba(59,130,246,0.3)" }}>
                            {item.order_status}
                          </span>
                          {item.backordered && (
                            <span className="badge" style={{ background:"rgba(239,68,68,0.15)", color:"#fca5a5", border:"1px solid rgba(239,68,68,0.3)", marginLeft:4 }}>
                              BACKORDERED
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={"oh-badge " + (isLow ? "low" : "ok")}>
                      <div className={"oh-num " + (isLow ? "low" : "ok")}>{oh}</div>
                      <div className="oh-unit">{item.unit || "on hand"}</div>
                    </div>
                  </div>
                  <div className="counts-row">
                    <div className="count-pill">
                      <div className="count-lbl">PAR</div>
                      <div className="count-val">{par}</div>
                    </div>
                    <div className="count-pill">
                      <div className="count-lbl">LOW</div>
                      <div className="count-val" style={{ color: low === 0 ? "#fcd34d" : "#f0f6ff" }}>{low}</div>
                    </div>
                    <div className="count-pill">
                      <div className="count-lbl">UNIT</div>
                      <div className="count-val" style={{ fontSize:11 }}>{item.unit || "—"}</div>
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
