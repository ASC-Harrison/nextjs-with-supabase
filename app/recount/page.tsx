"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Area = { id:string; name:string; is_main:boolean };
type Verification = {
  actual_on_hand:number;
  difference:number;
  verified_by:string;
  verified_at:string;
};
type InventoryRow = {
  item_id:string;
  name:string;
  reference_number:string|null;
  vendor:string|null;
  unit:string|null;
  category:string|null;
  shelf:string|null;
  on_hand:number;
  updated_at:string;
  last_verification:Verification|null;
};
type Filter = "ALL"|"ENTERED"|"CHANGED"|"VERIFIED";

const CSS = `
  :root{--bg:#080d19;--card:#131d30;--card2:#18253b;--line:#243b5d;--text:#f0f6ff;--muted:#7c8ba3;--blue:#3b82f6;--green:#10b981;--yellow:#f59e0b;--red:#ef4444}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:var(--bg)}
  .acc-root{min-height:100vh;background:radial-gradient(circle at 15% 0%,rgba(37,99,235,.16),transparent 30%),var(--bg);color:var(--text);padding:14px 14px 110px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .acc-wrap{max-width:900px;margin:0 auto}
  .top-btn{border:1px solid var(--line);background:#17243a;color:#9fb0c8;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer}
  .hero{margin-top:11px;padding:20px;border:1px solid rgba(96,165,250,.25);border-radius:20px;background:linear-gradient(145deg,#17243a,#101827);box-shadow:0 18px 45px rgba(0,0,0,.25);position:relative;overflow:hidden}
  .hero:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)}
  .hero h1{font-size:24px;margin:0;font-weight:950;letter-spacing:-.8px}
  .hero p{font-size:12px;color:var(--muted);line-height:1.5;margin:7px 0 0}
  .safe{margin-top:13px;border:1px solid rgba(16,185,129,.25);background:rgba(16,185,129,.08);color:#86efac;padding:10px 12px;border-radius:10px;font-size:11px;line-height:1.45}
  .panel{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
  .label{display:block;font-size:10px;font-weight:900;letter-spacing:.7px;color:#71819a;margin-bottom:6px}
  .select,.search{width:100%;border:1px solid #2b456b;border-radius:11px;background:#0d1524;color:var(--text);padding:12px 13px;font-size:14px;outline:none}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .stat{border:1px solid var(--line);border-radius:13px;background:var(--card);padding:12px;text-align:center}
  .stat strong{display:block;font-size:21px}.stat span{font-size:9px;font-weight:900;color:#71819a;letter-spacing:.6px}
  .filters{display:flex;gap:7px;overflow-x:auto;margin-top:12px;padding-bottom:2px}
  .filter{white-space:nowrap;border:1px solid var(--line);border-radius:999px;background:#111a2a;color:#8291a8;padding:7px 11px;font-size:11px;font-weight:850}
  .filter.on{background:rgba(59,130,246,.16);border-color:rgba(96,165,250,.5);color:#bfdbfe}
  .list-meta{font-size:10px;color:#56657a;margin:11px 2px 7px}
  .item{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:13px;margin-bottom:8px}
  .item.changed{border-color:rgba(245,158,11,.5);background:linear-gradient(145deg,rgba(245,158,11,.06),var(--card))}
  .item.entered:not(.changed){border-color:rgba(16,185,129,.35)}
  .item-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .item-name{font-size:13px;font-weight:900;line-height:1.35}.item-meta{font-size:10px;color:#71819a;line-height:1.5;margin-top:3px}
  .current{text-align:right;flex:0 0 auto}.current strong{display:block;font-size:21px}.current span{font-size:9px;color:#71819a;font-weight:900}
  .entry{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;margin-top:10px}
  .count-input{width:100%;border:1px solid #2b456b;border-radius:10px;background:#0d1524;color:#fff;padding:10px 12px;font-size:18px;font-weight:900;text-align:center;outline:none}
  .count-input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
  .diff{min-width:83px;text-align:center;border-radius:9px;padding:9px 8px;font-size:11px;font-weight:900;background:#111a2a;color:#71819a}
  .diff.plus{color:#86efac;background:rgba(16,185,129,.1)}.diff.minus{color:#fca5a5;background:rgba(239,68,68,.1)}.diff.same{color:#93c5fd;background:rgba(59,130,246,.1)}
  .verified{font-size:9px;color:#617189;margin-top:8px}
  .review-btn{width:100%;border:0;border-radius:12px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;padding:13px;font-size:14px;font-weight:950;cursor:pointer;margin-top:12px}
  .review-btn:disabled{opacity:.42}
  .review-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid rgba(36,59,93,.7)}
  .review-row:last-child{border-bottom:0}.review-values{text-align:right;font-size:11px;line-height:1.55;color:#9fb0c8}.review-values strong{font-size:14px;color:#fff}
  .warning{border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);color:#fcd34d;border-radius:11px;padding:11px;font-size:11px;line-height:1.5;margin-top:12px}
  .actions{display:grid;grid-template-columns:1fr 1.5fr;gap:9px;margin-top:13px}
  .btn{border:0;border-radius:11px;padding:12px;font-weight:900;font-size:13px;cursor:pointer}.btn.secondary{background:#202d43;color:#aab8cb;border:1px solid #304765}.btn.confirm{background:#10b981;color:#052e24}.btn:disabled{opacity:.45}
  .message{margin-top:12px;border-radius:11px;padding:11px 12px;font-size:12px;line-height:1.45}.message.ok{background:rgba(16,185,129,.09);border:1px solid rgba(16,185,129,.3);color:#86efac}.message.err{background:rgba(239,68,68,.09);border:1px solid rgba(239,68,68,.3);color:#fca5a5}
  .empty{border:1px dashed #243b5d;border-radius:14px;padding:30px;text-align:center;color:#66758a;font-size:12px;margin-top:10px}
  .more{display:block;margin:12px auto 0;border:1px solid #304765;background:#17243a;color:#9fb0c8;border-radius:10px;padding:10px 16px;font-weight:850}
  @media(min-width:720px){.acc-root{padding:22px 24px 120px}.item-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.item{margin-bottom:0}.stats{grid-template-columns:repeat(3,160px)}}
`;

export default function InventoryAccuracyPage() {
  const router = useRouter();
  const [areas,setAreas] = useState<Area[]>([]);
  const [areaId,setAreaId] = useState("");
  const [items,setItems] = useState<InventoryRow[]>([]);
  const [counts,setCounts] = useState<Record<string,string>>({});
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState<Filter>("ALL");
  const [stage,setStage] = useState<"COUNT"|"REVIEW">("COUNT");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [visibleLimit,setVisibleLimit] = useState(100);
  const [message,setMessage] = useState<{type:"ok"|"err";text:string}|null>(null);

  const authFetch = useCallback(async (url:string, options:RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Please sign in again.");
    return fetch(url, {
      ...options,
      cache:"no-store",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${data.session.access_token}`,
        ...(options.headers || {}),
      },
    });
  }, []);

  const loadArea = useCallback(async (requestedArea?:string, keepMessage=false) => {
    setLoading(true);
    if (!keepMessage) setMessage(null);
    try {
      const suffix = requestedArea ? `?area_id=${encodeURIComponent(requestedArea)}` : "";
      const response = await authFetch("/api/inventory-accuracy" + suffix);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load inventory");
      setAreas(data.areas || []);
      setAreaId(data.selected_area_id || "");
      setItems(data.items || []);
      setCounts({});
      setStage("COUNT");
      setVisibleLimit(100);
    } catch (error) {
      setMessage({type:"err",text:error instanceof Error ? error.message : "Could not load inventory"});
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadArea(); }, [loadArea]);

  const entered = useMemo(() => items.filter(item => counts[item.item_id] !== undefined && counts[item.item_id] !== ""), [items,counts]);
  const changed = useMemo(() => entered.filter(item => Number(counts[item.item_id]) !== item.on_hand), [entered,counts]);
  const selectedArea = areas.find(area => area.id === areaId)?.name || "Storage Area";

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      if (filter === "ENTERED" && !(counts[item.item_id] !== undefined && counts[item.item_id] !== "")) return false;
      if (filter === "CHANGED" && Number(counts[item.item_id]) === item.on_hand) return false;
      if (filter === "CHANGED" && (counts[item.item_id] === undefined || counts[item.item_id] === "")) return false;
      if (filter === "VERIFIED" && !item.last_verification) return false;
      if (!query) return true;
      return [item.name,item.reference_number,item.vendor,item.category,item.shelf]
        .some(value => (value || "").toLowerCase().includes(query));
    });
  }, [items,counts,search,filter]);

  function changeArea(nextArea:string) {
    if (entered.length > 0 && !window.confirm("Discard the counts you entered and switch areas? Nothing has been saved yet.")) return;
    void loadArea(nextArea);
  }

  function setCount(itemId:string, value:string) {
    const clean = value.replace(/\D/g,"").slice(0,7);
    setCounts(previous => ({...previous,[itemId]:clean}));
  }

  async function saveConfirmedCounts() {
    if (entered.length === 0 || saving) return;
    if (!window.confirm(`Save ${entered.length} verified counts for ${selectedArea}? This is the only step that can change live inventory.`)) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await authFetch("/api/inventory-accuracy", {
        method:"POST",
        body:JSON.stringify({
          area_id:areaId,
          counts:entered.map(item => ({
            item_id:item.item_id,
            expected_on_hand:item.on_hand,
            actual_on_hand:Number(counts[item.item_id]),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save counts");
      setMessage({
        type:"ok",
        text:`Saved safely: ${data.updated_count} corrected and ${data.unchanged_count} confirmed with no change.`,
      });
      await loadArea(areaId, true);
    } catch (error) {
      setMessage({type:"err",text:error instanceof Error ? error.message : "Could not save counts"});
      setStage("COUNT");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "REVIEW") {
    return <>
      <style dangerouslySetInnerHTML={{__html:CSS}} />
      <main className="acc-root"><div className="acc-wrap">
        <button className="top-btn" onClick={()=>setStage("COUNT")}>← Back to counting</button>
        <section className="hero">
          <h1>Review Before Saving</h1>
          <p>{selectedArea} · Nothing below has changed inventory yet.</p>
          <div className="safe">Every number is checked against the live database when you confirm. If another device changed an item, the entire batch stops and nothing is overwritten.</div>
        </section>
        {message && <div className={`message ${message.type}`}>{message.text}</div>}
        <section className="panel">
          <div className="label">COUNTS READY FOR CONFIRMATION</div>
          {entered.map(item => {
            const actual=Number(counts[item.item_id]);
            const difference=actual-item.on_hand;
            return <div className="review-row" key={item.item_id}>
              <div><div className="item-name">{item.name}</div><div className="item-meta">Ref: {item.reference_number||"—"} · {item.unit||"—"}</div></div>
              <div className="review-values"><div>Current: {item.on_hand}</div><div>Entered: <strong>{actual}</strong></div><div style={{color:difference===0?"#93c5fd":difference>0?"#86efac":"#fca5a5"}}>{difference===0?"No change":`Difference: ${difference>0?"+":""}${difference}`}</div></div>
            </div>;
          })}
          <div className="warning">Check this list carefully. Confirming changes only the selected area; it does not move, delete, deactivate, or rename any item.</div>
          <div className="actions">
            <button className="btn secondary" onClick={()=>setStage("COUNT")} disabled={saving}>Edit</button>
            <button className="btn confirm" onClick={saveConfirmedCounts} disabled={saving}>{saving?"Saving safely…":`Confirm ${entered.length} Counts`}</button>
          </div>
        </section>
      </div></main>
    </>;
  }

  return <>
    <style dangerouslySetInnerHTML={{__html:CSS}} />
    <main className="acc-root"><div className="acc-wrap">
      <button className="top-btn" onClick={()=>router.push("/")}>← Back</button>
      <section className="hero">
        <h1>🎯 Inventory Accuracy</h1>
        <p>Count one area at a time. Enter what you physically see, review every difference, then confirm once.</p>
        <div className="safe">Draft mode is safe: typing numbers does not change inventory. Live counts change only after the review and final confirmation.</div>
      </section>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <section className="panel">
        <label className="label">AREA BEING COUNTED</label>
        <select className="select" value={areaId} onChange={event=>changeArea(event.target.value)} disabled={loading}>
          {areas.map(area=><option key={area.id} value={area.id}>{area.name}{area.is_main?" · Main":""}</option>)}
        </select>
        <input className="search" style={{marginTop:10}} value={search} onChange={event=>{setSearch(event.target.value);setVisibleLimit(100);}} placeholder="Search item, reference, vendor, shelf…" />
      </section>

      <div className="stats">
        <div className="stat"><strong>{items.length}</strong><span>ITEMS IN AREA</span></div>
        <div className="stat"><strong style={{color:"#93c5fd"}}>{entered.length}</strong><span>ENTERED</span></div>
        <div className="stat"><strong style={{color:changed.length?"#fcd34d":"#86efac"}}>{changed.length}</strong><span>DIFFERENT</span></div>
      </div>

      <div className="filters">
        {(["ALL","ENTERED","CHANGED","VERIFIED"] as Filter[]).map(option=><button key={option} onClick={()=>{setFilter(option);setVisibleLimit(100);}} className={`filter ${filter===option?"on":""}`}>{option==="ALL"?"All Items":option==="ENTERED"?"Entered":option==="CHANGED"?"Differences":"Previously Verified"}</button>)}
      </div>

      <div className="list-meta">{loading?"Loading…":`Showing ${Math.min(filtered.length,visibleLimit)} of ${filtered.length} matching items`}</div>
      {loading ? <div className="empty">Loading the live area counts…</div> : filtered.length===0 ? <div className="empty">No items match this view.</div> :
        <div className="item-list">{filtered.slice(0,visibleLimit).map(item=>{
          const raw=counts[item.item_id];
          const hasEntry=raw!==undefined&&raw!=="";
          const actual=hasEntry?Number(raw):null;
          const difference=actual===null?null:actual-item.on_hand;
          return <article key={item.item_id} className={`item ${hasEntry?"entered":""} ${difference!==null&&difference!==0?"changed":""}`}>
            <div className="item-head">
              <div><div className="item-name">{item.name}</div><div className="item-meta">{item.vendor||"—"} · Ref: {item.reference_number||"—"} · {item.unit||"—"}{item.shelf?` · Shelf: ${item.shelf}`:""}</div></div>
              <div className="current"><strong>{item.on_hand}</strong><span>CURRENT</span></div>
            </div>
            <div className="entry">
              <input className="count-input" inputMode="numeric" type="text" value={raw??""} onChange={event=>setCount(item.item_id,event.target.value)} placeholder="Enter actual count" aria-label={`Actual count for ${item.name}`} />
              <div className={`diff ${difference===null?"":difference===0?"same":difference>0?"plus":"minus"}`}>{difference===null?"Not entered":difference===0?"Matches":`${difference>0?"+":""}${difference}`}</div>
            </div>
            {item.last_verification && <div className="verified">Last verified {new Date(item.last_verification.verified_at).toLocaleDateString()} by {item.last_verification.verified_by}</div>}
          </article>;
        })}</div>
      }
      {filtered.length>visibleLimit && <button className="more" onClick={()=>setVisibleLimit(value=>value+100)}>Show 100 More</button>}
      <button className="review-btn" disabled={entered.length===0||loading} onClick={()=>{setMessage(null);setStage("REVIEW");}}>Review {entered.length} Entered {entered.length===1?"Count":"Counts"}</button>
    </div></main>
  </>;
}
