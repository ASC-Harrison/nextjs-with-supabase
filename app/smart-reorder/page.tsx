"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@supabase/supabase-js";
import type {ReorderRow} from "@/lib/reorder-plan";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Plan = {generated_at: string; rows: ReorderRow[]; summary: {active_items: number; out_of_stock: number; needs_reorder: number; existing_requests: number; missing_targets: number}; automation: string};
const css = `
.sr{min-height:100vh;background:#080d19;color:#f8fafc;padding:18px 14px 110px;font-family:system-ui,sans-serif}.sr-wrap{max-width:1000px;margin:auto}.sr nav,.sr-tools{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px}.sr button,.sr a{font:700 13px system-ui;cursor:pointer;border:1px solid #334155;border-radius:10px;background:#18243a;color:#dbeafe;padding:10px 13px;text-decoration:none}.sr button:disabled{opacity:.5;cursor:wait}.sr button:focus-visible,.sr a:focus-visible,.sr input:focus-visible,.sr select:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}.sr-hero{background:linear-gradient(135deg,#391d30,#15243b);border:1px solid #63334b;border-radius:20px;padding:24px;margin-bottom:14px}.sr h1{margin:0 0 8px;font-size:30px;letter-spacing:-1px}.sr p{line-height:1.55;color:#b4c1d4;margin:8px 0}.sr-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin:14px 0}.sr-metric,.sr-card,.sr-brief{background:#152033;border:1px solid #293b55;border-radius:14px;padding:16px}.sr-metric strong{display:block;font-size:25px;color:#fecaca}.sr-metric span{font-size:12px;color:#a9bad2}.sr-brief{margin-bottom:14px}.sr-brief pre{font:14px/1.6 system-ui;white-space:pre-wrap;overflow-wrap:anywhere}.sr input,.sr select{background:#101a2b;border:1px solid #334155;border-radius:10px;padding:12px;color:#f8fafc;font-size:14px}.sr input{flex:1;min-width:170px}.sr-list{display:grid;gap:10px}.sr-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.sr-card h2{font-size:17px;margin:0 0 4px}.sr-meta{font-size:12px;color:#a9bad2}.sr-status{font-size:11px;font-weight:800;color:#fcd34d}.sr-numbers{display:flex;gap:22px;flex-wrap:wrap;margin:15px 0}.sr-numbers strong{display:block;font-size:20px}.sr-numbers span{font-size:11px;color:#9eb1ca}.sr-tag{display:inline-block;background:#1d2e48;border-radius:6px;color:#bfdbfe;font-size:11px;padding:5px 7px;margin:3px}.sr .sr-primary{background:#9d2235;border-color:#be3450;color:white}.sr-error{padding:14px;background:#451d28;color:#fecaca;border-radius:10px;margin-bottom:12px}.sr-warning{border-left:3px solid #f59e0b;padding-left:12px;font-size:13px}.sr-count{color:#94a3b8;font-size:12px;margin:10px 0}@media(max-width:500px){.sr-hero{padding:18px}.sr h1{font-size:26px}.sr-tools select{width:100%}}
`;

export default function SmartReorder() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("attention");
  const [brief, setBrief] = useState(""), [thinking, setThinking] = useState(false);
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const {data} = await db.auth.getSession();
    if (!data.session) throw new Error("Please sign in to view inventory planning.");
    return fetch(url, {...options, headers: {"Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`}, cache: "no-store"});
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(""); setBrief("");
    try {const response = await authFetch("/api/reorder-plan"), data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Could not load plan"); setPlan(data);}
    catch (e) {setError(e instanceof Error ? e.message : "Could not load plan");}
    finally {setLoading(false);}
  }, [authFetch]);
  useEffect(() => {void load();}, [load]);
  const rows = useMemo(() => (plan?.rows || []).filter(row => {
    const matches = `${row.name} ${row.reference_number || ""} ${row.vendor || ""}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter === "all" || (filter === "attention" && row.status !== "AT TARGET") || (filter === "suggested" && (row.suggested_quantity ?? 0) > 0) || (filter === "open" && row.open_orders > 0) || (filter === "setup" && (row.par <= 0 || row.suggested_quantity === null)));
  }), [plan, search, filter]);
  async function askAI() {
    setThinking(true); setError("");
    try {
      const response = await authFetch("/api/ai-command", {method: "POST", body: JSON.stringify({message: "Review the live reorder plan. Explain the most urgent shortages, existing requests to follow up on, and missing information that prevents automatic purchasing. Use reorder_plan as the authority for suggested quantities; do not claim forecasts, cost totals, or orders placed. Give me the three most useful next actions."})});
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "AI briefing unavailable"); setBrief(data.answer);
    } catch (e) {setError(e instanceof Error ? e.message : "AI briefing unavailable");}
    finally {setThinking(false);}
  }
  function exportPlan() {
    const fields = ["Item", "Reference", "Vendor", "Inventory unit", "On hand", "PAR", "Open quantity", "Suggested quantity", "Open requests", "Checks"];
    const escape = (value: unknown) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    const csv = [fields, ...rows.map(r => [r.name, r.reference_number, r.vendor, r.unit, r.on_hand, r.par, r.open_quantity, r.suggested_quantity, r.open_orders, r.blockers.join("; ")])].map(line => line.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8;"})); const a = document.createElement("a"); a.href = url; a.download = "ASC-reorder-review.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="sr"><style>{css}</style><div className="sr-wrap">
    <nav aria-label="Inventory tools"><button onClick={() => router.push("/")}>← Dashboard</button><button onClick={() => router.push("/order-history")}>Order History</button><button onClick={() => router.push("/ai")}>AI Command Center</button></nav>
    <section className="sr-hero"><div className="sr-meta">BAXTER ASC · INVENTORY PLANNING</div><h1>Smart Reorder</h1><p>A clear list of what needs attention, what is already requested, and what to check before ordering.</p><p className="sr-warning">Approval mode: suggestions use recorded counts and PAR targets. Usage history is incomplete, so run-out dates and automatic purchases are not enabled.</p></section>
    {error && <div className="sr-error" role="alert">{error}</div>}
    {plan && <><div className="sr-metrics">{[[plan.summary.out_of_stock, "Out of stock"], [plan.summary.needs_reorder, "Suggested top-ups"], [plan.summary.existing_requests, "Items with open requests"], [plan.summary.missing_targets, "Need a PAR target"]].map(([value, label]) => <div className="sr-metric" key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <section className="sr-brief"><div className="sr-top"><div><strong>AI ordering briefing</strong><p>Explain priorities and data gaps using the current records.</p></div><button className="sr-primary" disabled={thinking || loading} onClick={() => void askAI()}>{thinking ? "Reviewing inventory…" : "Generate AI briefing"}</button></div>{brief && <pre aria-live="polite">{brief}</pre>}</section></>}
    <div className="sr-tools"><input aria-label="Search inventory" placeholder="Search product, reference, or vendor…" value={search} onChange={event => setSearch(event.target.value)}/><select aria-label="Filter reorder list" value={filter} onChange={event => setFilter(event.target.value)}><option value="attention">Needs attention</option><option value="suggested">Suggested top-ups</option><option value="open">Open requests</option><option value="setup">Needs setup</option><option value="all">All inventory</option></select><button disabled={loading || thinking} onClick={() => void load()}>{loading ? "Checking…" : "Refresh"}</button><button disabled={!plan || loading} onClick={exportPlan}>Export review list</button></div>
    {plan && <div className="sr-count">{rows.length} shown · {plan.summary.active_items} active items checked · Updated {new Date(plan.generated_at).toLocaleString()}</div>}
    {loading ? <p role="status">Checking inventory and open orders…</p> : <div className="sr-list">{rows.map(row => <article className="sr-card" key={row.item_id}><div className="sr-top"><div><h2>{row.name}</h2><div className="sr-meta">{row.reference_number || "No reference"} · {row.vendor || "Vendor needed"} · Count unit: {row.unit || "Unknown"}</div></div><div className="sr-status">{row.status}{row.backordered ? " · BACKORDER FLAG" : ""}</div></div><div className="sr-numbers"><div><strong>{row.on_hand ?? "?"}</strong><span>On hand</span></div><div><strong>{row.par || "—"}</strong><span>PAR target</span></div><div><strong>{row.open_quantity ?? "Verify"}</strong><span>Already requested*</span></div><div><strong>{row.suggested_quantity ?? "Review"}</strong><span>Suggested top-up ({row.unit || "unit needed"})</span></div></div><p>{row.reason}</p>{row.open_orders > 0 && <p className="sr-warning">{row.open_orders} open request(s). Check status before ordering more. Pending, backordered, and issue requests are not confirmed incoming stock.</p>}<div>{row.blockers.map(blocker => <span className="sr-tag" key={blocker}>{blocker}</span>)}</div><p className="sr-meta">Saved price: {row.saved_price === null ? "Unknown" : row.saved_price.toLocaleString("en-US", {style: "currency", currency: "USD"})} · Package basis must be verified before estimating spend.</p></article>)}{plan && !rows.length && <p>No items match this view.</p>}</div>}
    <section className="sr-brief" style={{marginTop: 16}}><strong>Getting ready for automatic ordering</strong><p>1. Record quantities used and keep counts current.<br/>2. Confirm each, box, and case quantities and prices.<br/>3. Set supplier delivery times, allowed products, and spending limits.<br/>4. Connect vendor ordering and test the approval workflow.</p><p className="sr-meta">*Already requested reserves remaining quantities from open requests to reduce duplicate suggestions. It does not increase on-hand stock. Refresh before acting; these are planning recommendations.</p></section>
  </div></main>;
}
