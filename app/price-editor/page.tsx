"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = {
  id: string;
  name: string;
  vendor: string | null;
  category: string | null;
  reference_number: string | null;
  unit: string | null;
  price: number | null;
  units_per_box: number | null;
  price_source: string | null;
  price_updated_at: string | null;
};

type Draft = {
  price: string;
  vendor: string;
  unitsPerBox: string;
  source: string;
};

type PriceHistory = {
  id: string;
  item_id: string;
  previous_price: number | null;
  new_price: number | null;
  previous_units_per_box: number | null;
  new_units_per_box: number | null;
  previous_vendor: string | null;
  new_vendor: string | null;
  source: string | null;
  changed_by_name: string | null;
  created_at: string;
  items?: { name?: string; reference_number?: string | null } | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#080d19;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
  .root{min-height:100vh;color:#f1f5f9;padding:14px 14px 95px;background:radial-gradient(circle at 12% 0%,rgba(234,179,8,.11),transparent 30%),#080d19}
  .wrap{width:100%;max-width:980px;margin:0 auto}
  .back{border:1px solid rgba(148,163,184,.16);background:rgba(30,41,59,.72);color:#94a3b8;border-radius:10px;padding:8px 12px;font:750 12px inherit;cursor:pointer;margin-bottom:10px}
  .hero{border:1px solid rgba(234,179,8,.18);border-radius:22px;padding:19px;background:linear-gradient(145deg,rgba(30,41,59,.95),rgba(15,23,42,.95));box-shadow:0 24px 60px rgba(0,0,0,.24);margin-bottom:12px;position:relative;overflow:hidden}
  .hero::before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,#eab308,#f59e0b,#10b981)}
  .title{font-size:25px;font-weight:950;letter-spacing:-.7px}
  .subtitle{font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.4}
  .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:16px}
  .stat{border:1px solid rgba(148,163,184,.11);background:rgba(2,6,23,.38);border-radius:12px;padding:10px}
  .stat-value{font-size:20px;font-weight:950;line-height:1}
  .stat-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.45px;font-weight:850;margin-top:5px}
  .notice{border:1px solid rgba(59,130,246,.2);background:rgba(59,130,246,.07);border-radius:12px;color:#93c5fd;font-size:11px;line-height:1.45;padding:10px 12px;margin-bottom:11px}
  .toolbar{border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.68);border-radius:16px;padding:10px;margin-bottom:11px}
  .search{width:100%;border:1px solid rgba(148,163,184,.17);background:#0f172a;color:#f8fafc;border-radius:11px;padding:11px 12px;font:13px inherit;outline:none}
  .search:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.12)}
  .filters{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .filter{border:1px solid rgba(148,163,184,.15);background:rgba(30,41,59,.7);color:#94a3b8;border-radius:9px;padding:7px 10px;font:800 11px inherit;cursor:pointer}
  .filter.active{background:#2563eb;border-color:#3b82f6;color:white}
  .count{font-size:10px;color:#475569;margin:0 2px 8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:9px}
  .item{border:1px solid rgba(148,163,184,.13);background:linear-gradient(145deg,rgba(30,41,59,.83),rgba(15,23,42,.88));border-radius:16px;padding:13px;box-shadow:0 14px 35px rgba(0,0,0,.12)}
  .item.unpriced{border-color:rgba(245,158,11,.25)}
  .item-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:11px}
  .item-name{font-size:13px;font-weight:900;line-height:1.25;color:#f8fafc}
  .item-meta{font-size:10px;color:#64748b;margin-top:4px;line-height:1.35}
  .price-badge{font-size:12px;font-weight:950;color:#6ee7b7;white-space:nowrap}
  .missing{color:#fcd34d}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  .field-wide{grid-column:1/-1}
  label{display:block;font-size:9px;color:#64748b;font-weight:850;text-transform:uppercase;letter-spacing:.45px;margin:0 0 4px 2px}
  input,select{width:100%;border:1px solid rgba(148,163,184,.16);background:#0f172a;color:#f8fafc;border-radius:9px;padding:9px 9px;font:12px inherit;outline:none}
  input:focus,select:focus{border-color:#3b82f6}
  .unit-cost{display:flex;justify-content:space-between;gap:8px;align-items:center;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:9px;padding:8px 9px;margin-top:8px;font-size:10px;color:#94a3b8}
  .unit-cost strong{color:#6ee7b7;font-size:12px}
  .save{width:100%;border:0;background:#2563eb;color:white;border-radius:10px;padding:10px;margin-top:9px;font:850 12px inherit;cursor:pointer}
  .save:disabled{opacity:.42;cursor:not-allowed}
  .updated{font-size:9px;color:#475569;text-align:center;margin-top:6px}
  .history{display:flex;flex-direction:column;gap:8px}
  .history-row{border:1px solid rgba(148,163,184,.12);background:rgba(30,41,59,.66);border-radius:13px;padding:12px}
  .history-top{display:flex;justify-content:space-between;gap:9px}
  .history-name{font-size:12px;font-weight:850;color:#f8fafc}
  .history-time{font-size:9px;color:#475569;white-space:nowrap}
  .history-change{font-size:12px;color:#cbd5e1;margin-top:6px}
  .history-change strong{color:#6ee7b7}
  .history-meta{font-size:10px;color:#64748b;margin-top:5px}
  .message{border-radius:11px;padding:10px 12px;font-size:11px;margin-bottom:10px}
  .message.ok{color:#6ee7b7;border:1px solid rgba(16,185,129,.25);background:rgba(16,185,129,.08)}
  .message.err{color:#fca5a5;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.08)}
  .empty{text-align:center;color:#475569;font-size:12px;padding:46px 15px}
  @media(max-width:620px){.root{padding:10px 9px 95px}.stats{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.hero{padding:16px}.title{font-size:22px}}
`;

function currency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function timeLabel(value: string | null | undefined) {
  if (!value) return "Not updated yet";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PricingCenterPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all"|"unpriced"|"recent">("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{type:"ok"|"err";text:string}|null>(null);

  async function loadHistory() {
    const { data } = await supabase
      .from("item_price_history")
      .select("id,item_id,previous_price,new_price,previous_units_per_box,new_units_per_box,previous_vendor,new_vendor,source,changed_by_name,created_at,items(name,reference_number)")
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory((data as unknown as PriceHistory[]) || []);
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const [itemsResult, historyResult] = await Promise.all([
        supabase
          .from("items")
          .select("id,name,vendor,category,reference_number,unit,price,units_per_box,price_source,price_updated_at")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("item_price_history")
          .select("id,item_id,previous_price,new_price,previous_units_per_box,new_units_per_box,previous_vendor,new_vendor,source,changed_by_name,created_at,items(name,reference_number)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (itemsResult.error) {
        setMessage({ type:"err", text:"Could not load pricing records." });
      } else {
        const rows = (itemsResult.data as Item[]) || [];
        setItems(rows);
        setDrafts(Object.fromEntries(rows.map(item => [
          item.id,
          {
            price: item.price === null ? "" : String(item.price),
            vendor: item.vendor || "",
            unitsPerBox: String(item.units_per_box || 1),
            source: item.price_source || "",
          },
        ])));
      }
      setHistory((historyResult.data as unknown as PriceHistory[]) || []);
      setLoading(false);
    }
    void load();
  }, [router]);

  const pricedCount = items.filter(item => Number(item.price) > 0).length;
  const unpricedCount = items.length - pricedCount;
  const updatedRecently = items.filter(item => {
    if (!item.price_updated_at) return false;
    return Date.now() - new Date(item.price_updated_at).getTime() < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const coverage = items.length ? Math.round((pricedCount / items.length) * 100) : 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      if (view === "unpriced" && Number(item.price) > 0) return false;
      if (!query) return true;
      return [item.name,item.vendor,item.category,item.reference_number,item.unit]
        .some(value => (value || "").toLowerCase().includes(query));
    });
  }, [items, search, view]);

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts(current => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  function hasChanges(item: Item) {
    const draft = drafts[item.id];
    if (!draft) return false;
    return (
      draft.price !== (item.price === null ? "" : String(item.price)) ||
      draft.vendor.trim() !== (item.vendor || "") ||
      Number(draft.unitsPerBox || 1) !== Number(item.units_per_box || 1) ||
      draft.source.trim() !== (item.price_source || "")
    );
  }

  async function saveItem(item: Item) {
    const draft = drafts[item.id];
    if (!draft || savingId) return;
    setSavingId(item.id);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/pricing", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:"Bearer " + sessionData.session.access_token,
        },
        body:JSON.stringify({
          item_id:item.id,
          price:draft.price.trim() === "" ? null : Number(draft.price),
          vendor:draft.vendor,
          units_per_box:draft.unitsPerBox.trim() === "" ? null : Number(draft.unitsPerBox),
          source:draft.source,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Price failed to save.");

      const updated = result.item as Item;
      setItems(current => current.map(row => row.id === item.id ? { ...row, ...updated } : row));
      setDrafts(current => ({
        ...current,
        [item.id]: {
          price: updated.price === null ? "" : String(updated.price),
          vendor: updated.vendor || "",
          unitsPerBox: String(updated.units_per_box || 1),
          source: updated.price_source || "",
        },
      }));
      await loadHistory();
      setMessage({ type:"ok", text:item.name + " pricing saved with a history record." });
    } catch (error: any) {
      setMessage({ type:"err", text:error?.message || "Price failed to save." });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="root">
        <div className="wrap">
          <button className="back" onClick={() => router.push("/")}>← Dashboard</button>

          <section className="hero">
            <div className="title">💰 Pricing Center</div>
            <div className="subtitle">Track what you paid, package quantity, per-unit cost, vendor, source, and every price change.</div>
            <div className="stats">
              <div className="stat"><div className="stat-value" style={{color:"#6ee7b7"}}>{pricedCount}</div><div className="stat-label">Priced Items</div></div>
              <div className="stat"><div className="stat-value" style={{color:"#fcd34d"}}>{unpricedCount}</div><div className="stat-label">Missing Price</div></div>
              <div className="stat"><div className="stat-value" style={{color:"#93c5fd"}}>{coverage}%</div><div className="stat-label">Coverage</div></div>
              <div className="stat"><div className="stat-value" style={{color:"#c4b5fd"}}>{updatedRecently}</div><div className="stat-label">Updated 30 Days</div></div>
            </div>
          </section>

          <div className="notice">
            Enter the price paid for the package and how many individual units were inside. The app calculates the per-unit cost automatically. Pricing changes never alter on-hand inventory.
          </div>

          {message ? <div className={"message " + message.type}>{message.text}</div> : null}

          <section className="toolbar">
            <input className="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, reference number, vendor, or category…" />
            <div className="filters">
              <button className={"filter " + (view === "all" ? "active" : "")} onClick={() => setView("all")}>All Items</button>
              <button className={"filter " + (view === "unpriced" ? "active" : "")} onClick={() => setView("unpriced")}>Missing Price ({unpricedCount})</button>
              <button className={"filter " + (view === "recent" ? "active" : "")} onClick={() => setView("recent")}>Price History ({history.length})</button>
            </div>
          </section>

          {view === "recent" ? (
            <section className="history">
              {history.length === 0 ? <div className="empty">No price changes have been recorded yet.</div> : history.map(entry => {
                const related = Array.isArray(entry.items) ? entry.items[0] : entry.items;
                return (
                  <div className="history-row" key={entry.id}>
                    <div className="history-top">
                      <div className="history-name">{related?.name || "Inventory item"}{related?.reference_number ? " · Ref " + related.reference_number : ""}</div>
                      <div className="history-time">{timeLabel(entry.created_at)}</div>
                    </div>
                    <div className="history-change">{currency(entry.previous_price)} → <strong>{currency(entry.new_price)}</strong></div>
                    <div className="history-meta">
                      Package {entry.previous_units_per_box || 1} → {entry.new_units_per_box || 1}
                      {" · "}{entry.new_vendor || "No vendor"}
                      {entry.source ? " · " + entry.source : ""}
                      {entry.changed_by_name ? " · " + entry.changed_by_name : ""}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : loading ? (
            <div className="empty">Loading pricing records…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No items match this view.</div>
          ) : (
            <>
              <div className="count">Showing {Math.min(filtered.length, 150)} of {filtered.length} matching items. Search to find any item quickly.</div>
              <section className="grid">
                {filtered.slice(0,150).map(item => {
                  const draft = drafts[item.id];
                  if (!draft) return null;
                  const price = Number(draft.price);
                  const packageQty = Number(draft.unitsPerBox || 1);
                  const unitCost = price > 0 && packageQty > 0 ? price / packageQty : null;
                  const changed = hasChanges(item);
                  return (
                    <article className={"item " + (price > 0 ? "" : "unpriced")} key={item.id}>
                      <div className="item-head">
                        <div>
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            {item.reference_number ? "Ref " + item.reference_number : "No reference number"}
                            {" · "}{item.category || "Uncategorized"}
                          </div>
                        </div>
                        <div className={"price-badge " + (price > 0 ? "" : "missing")}>{price > 0 ? currency(price) : "Missing"}</div>
                      </div>

                      <div className="fields">
                        <div>
                          <label>Price Paid</label>
                          <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.price} onChange={event => updateDraft(item.id,"price",event.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                          <label>Units in Package</label>
                          <input type="number" min="1" step="1" inputMode="numeric" value={draft.unitsPerBox} onChange={event => updateDraft(item.id,"unitsPerBox",event.target.value)} placeholder="1" />
                        </div>
                        <div className="field-wide">
                          <label>Vendor</label>
                          <input value={draft.vendor} onChange={event => updateDraft(item.id,"vendor",event.target.value)} placeholder="Vendor or supplier" />
                        </div>
                        <div className="field-wide">
                          <label>Price Source</label>
                          <select value={draft.source} onChange={event => updateDraft(item.id,"source",event.target.value)}>
                            <option value="">Select source</option>
                            <option value="Invoice">Invoice</option>
                            <option value="Vendor quote">Vendor quote</option>
                            <option value="Contract">Contract</option>
                            <option value="Website">Website</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="unit-cost"><span>Calculated cost per individual unit</span><strong>{currency(unitCost)}</strong></div>
                      <button className="save" disabled={!changed || savingId !== null} onClick={() => void saveItem(item)}>
                        {savingId === item.id ? "Saving…" : changed ? "Save Pricing Changes" : "Pricing Saved"}
                      </button>
                      <div className="updated">{timeLabel(item.price_updated_at)}</div>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
