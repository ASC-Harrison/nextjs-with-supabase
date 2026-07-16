"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PREOP_AREA_ID = "15582bf1-3096-4b49-b436-3a97fd24ecd5";
const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";
const ORDER_PIN = "1620";

type Item = {
  item_id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  on_hand: number;
  par_level: number;
  low_level: number;
  alert_note?: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 0 80px;}
  .header{background:linear-gradient(135deg,#162032,#111827);border-bottom:1px solid #1e3a5f;padding:16px;position:sticky;top:0;z-index:40;}
  .header-top{display:flex;align-items:center;justify-content:space-between;max-width:700px;margin:0 auto;}
  .header-title{font-size:20px;font-weight:900;color:#f0f6ff;letter-spacing:-0.5px;}
  .header-sub{font-size:11px;color:#64748b;margin-top:2px;}
  .back-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#94a3b8;cursor:pointer;font-family:inherit;}
  .wrap{max-width:700px;margin:0 auto;padding:16px;}
  .search-row{display:flex;gap:8px;margin-bottom:12px;align-items:center;}
  .search-inp{flex:1;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;}
  .low-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;white-space:nowrap;}
  .low-on{background:rgba(239,68,68,0.15);color:#fca5a5;border-color:rgba(239,68,68,0.4);}
  .low-off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .item-card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:14px;margin-bottom:10px;position:relative;overflow:hidden;}
  .item-card.low{border-color:rgba(239,68,68,0.4);}
  .item-card.low::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#ef4444;}
  .item-card.ok::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#10b981;}
  .item-name{font-size:14px;font-weight:800;color:#f0f6ff;word-break:break-word;margin-bottom:3px;}
  .item-meta{font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.6;}
  .pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
  .pill{background:#1e2d42;border:1px solid #1e3a5f;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;color:#64748b;}
  .pill span{color:#f0f6ff;}
  .oh-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}
  .oh-badge{border-radius:8px;padding:8px 14px;text-align:center;flex-shrink:0;}
  .oh-badge.low{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);}
  .oh-badge.ok{background:#1e2d42;border:1px solid #1e3a5f;}
  .oh-num{font-size:22px;font-weight:900;letter-spacing:-1px;line-height:1;}
  .oh-num.low{color:#ef4444;}
  .oh-num.ok{color:#f0f6ff;}
  .oh-unit{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:2px;}
  .tx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .mode-btn{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;}
  .mode-use{background:rgba(239,68,68,0.12);color:#fca5a5;border-color:rgba(239,68,68,0.3);}
  .mode-use.active{background:rgba(239,68,68,0.25);border-color:#ef4444;}
  .mode-restock{background:rgba(16,185,129,0.12);color:#6ee7b7;border-color:rgba(16,185,129,0.3);}
  .mode-restock.active{background:rgba(16,185,129,0.25);border-color:#10b981;}
  .qty-row{display:flex;align-items:center;gap:6px;}
  .qty-btn{width:32px;height:32px;border-radius:8px;background:#1e2d42;border:1px solid #1e3a5f;color:#f0f6ff;font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;}
  .qty-inp{width:56px;border-radius:8px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:6px 8px;font-size:16px;font-weight:800;text-align:center;font-family:inherit;outline:none;}
  .submit-btn{border-radius:10px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .submit-use{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;}
  .submit-restock{background:linear-gradient(135deg,#10b981,#059669);color:#fff;}
  .submit-btn:disabled{opacity:0.5;cursor:not-allowed;}
  .order-btn{width:100%;border-radius:12px;padding:14px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;margin-bottom:16px;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#111827;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:700px;max-height:85vh;overflow-y:auto;}
  .modal-title{font-size:18px;font-weight:900;color:#f0f6ff;margin-bottom:16px;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#162032;color:#f0f6ff;padding:12px 14px;font-size:15px;font-family:inherit;outline:none;margin-bottom:12px;}
  .btn{border-radius:10px;padding:12px 20px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;font-size:12px;color:#fca5a5;margin-bottom:10px;}
  .ok-msg{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px;font-size:12px;color:#6ee7b7;margin-bottom:10px;}
  .order-item-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e3a5f;}
  .count-badge{font-size:11px;color:#334155;margin-bottom:8px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .skel{animation:pulse 1.5s infinite;background:#162032;border-radius:10px;}
`;

export default function PreOpPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [namePrompt, setNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{id:string;type:"ok"|"err";text:string} | null>(null);

  // Order request state
  const [orderPinOpen, setOrderPinOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderPin, setOrderPin] = useState("");
  const [orderPinErr, setOrderPinErr] = useState(false);
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{type:"ok"|"err";text:string}|null>(null);

  // Per-item tx state
  const [txMode, setTxMode] = useState<Record<string, "USE"|"RESTOCK">>({});
  const [txQty, setTxQty] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const name = data.session.user.user_metadata?.full_name || data.session.user.email || "";
        if (name) {
          setStaffName(name);
          setNamePrompt(false);
        } else {
          const saved = localStorage.getItem("preop_staff_name") || "";
          if (saved) setStaffName(saved);
          else setNamePrompt(true);
        }
      } else {
        const saved = localStorage.getItem("preop_staff_name") || "";
        if (saved) setStaffName(saved);
        else setNamePrompt(true);
      }
    });
    loadItems();
  }, []);

  // Send heartbeat to staff_presence every 30 seconds
  useEffect(() => {
    if (!staffName) return;
    async function sendHeartbeat() {
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_name: staffName, current_area: "Pre-Op/PACU" }),
      }).catch(() => {});
    }
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [staffName]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("storage_inventory_area_view")
        .select("item_id, item_name, reference_number, vendor, unit, on_hand, par_level, low_level")
        .eq("storage_area_id", PREOP_AREA_ID)
        .gt("par_level", 0)
        .order("item_name");
      if (data) {
        const rows = data.map((r: any) => ({
          item_id: r.item_id,
          name: r.item_name,
          reference_number: r.reference_number,
          vendor: r.vendor,
          unit: r.unit,
          on_hand: r.on_hand ?? 0,
          par_level: r.par_level ?? 0,
          low_level: r.low_level ?? 0,
        }));
        // Fetch actual on_hand from Main Supply since numbers are now unified
        const ids = rows.map(r => r.item_id);
        if (ids.length > 0) {
          const { data: areaData } = await supabase
            .from("storage_inventory")
            .select("item_id, on_hand")
            .eq("storage_area_id", MAIN_SUPPLY_ID)
            .in("item_id", ids);
          if (areaData) {
            const areaMap = Object.fromEntries(areaData.map((r: any) => [r.item_id, r.on_hand]));
            rows.forEach(r => { r.on_hand = areaMap[r.item_id] ?? r.on_hand; });
          }
          // Fetch alert notes
          const { data: noteData } = await supabase.from("items").select("id,alert_note").in("id", ids);
          if (noteData) {
            const noteMap = Object.fromEntries(noteData.map((n: any) => [n.id, n.alert_note]));
            rows.forEach((r: any) => { r.alert_note = noteMap[r.item_id] || null; });
          }
        }
        setItems(rows);
        const modes: Record<string,any> = {};
        const qtys: Record<string,number> = {};
        rows.forEach(r => { modes[r.item_id] = "USE"; qtys[r.item_id] = 1; });
        setTxMode(modes); setTxQty(qtys);
      }
    } catch {}
    setLoading(false);
  }

  async function submitTx(item: Item) {
    if (!staffName.trim()) { setNamePrompt(true); return; }
    const mode = txMode[item.item_id] || "USE";
    const qty = txQty[item.item_id] || 1;
    setSubmitting(item.item_id);
    try {
      if (mode === "USE") {
        const { error } = await supabase.rpc("use_stock", {
          p_item_id: item.item_id,
          p_area_id: MAIN_SUPPLY_ID,
          p_qty: qty,
        });
        if (error) throw new Error(error.message);
        setItems(prev => prev.map(i => i.item_id === item.item_id ? { ...i, on_hand: Math.max(0, i.on_hand - qty) } : i));
      } else {
        const { error } = await supabase.rpc("add_stock", {
          p_item_id: item.item_id,
          p_area_id: MAIN_SUPPLY_ID,
          p_qty: qty,
        });
        if (error) throw new Error(error.message);
        setItems(prev => prev.map(i => i.item_id === item.item_id ? { ...i, on_hand: i.on_hand + qty } : i));
      }
      // Log audit
      await supabase.from("audit_log").insert({
        staff_name: staffName,
        action: "SUBMIT_TX",
        area_name: "Pre-Op/PACU",
        details: `Mode=${mode} Qty=${qty} Item=${item.name} Area=Pre-Op/PACU`,
      });
      setMsg({ id: item.item_id, type:"ok", text: `${mode === "USE" ? "Used" : "Restocked"} ${qty} × ${item.name}` });
      setTxQty(prev => ({ ...prev, [item.item_id]: 1 }));
      setTimeout(() => setMsg(null), 3000);
    } catch(e: any) {
      setMsg({ id: item.item_id, type:"err", text: e?.message ?? "Transaction failed — check connection" });
      setTimeout(() => setMsg(null), 5000);
    }
    setSubmitting(null);
  }

  async function sendOrderRequest() {
    const selected = items.filter(r => orderItems[r.item_id] !== undefined);
    if (!selected.length) { setOrderMsg({ type:"err", text:"Select at least one item." }); return; }
    setOrdering(true);
    try {
      const res = await fetch("/api/order-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: staffName || "Pre-Op/PACU Staff",
          items: selected.map(r => ({
            name: r.name,
            item_id: r.item_id,
            reference_number: r.reference_number,
            vendor: r.vendor,
            unit: r.unit,
            qty: orderItems[r.item_id] || 1,
            alert_note: r.alert_note || null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setOrderMsg({ type:"ok", text:"✅ Order request sent!" });
      setOrderItems({});
      setTimeout(() => { setOrderOpen(false); setOrderMsg(null); }, 2000);
    } catch(e: any) {
      setOrderMsg({ type:"err", text: e?.message ?? "Failed to send order" });
    }
    setOrdering(false);
  }

  const filtered = items.filter(i => {
    if (lowOnly && i.on_hand > i.low_level) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q) || (i.vendor || "").toLowerCase().includes(q) || (i.reference_number || "").toLowerCase().includes(q);
    }
    return true;
  });

  const lowCount = items.filter(i => i.low_level > 0 && i.on_hand <= i.low_level).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="header-title">Pre-Op / PACU</div>
              <div className="header-sub" style={{ display:"flex", alignItems:"center", gap:8 }}>
                {staffName ? `Staff: ${staffName}` : "Tap to set your name"} · {items.length} items
                {staffName && <button onClick={() => { setNameInput(staffName); setNamePrompt(true); }} style={{ background:"none", border:"none", color:"#3b82f6", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:0, textDecoration:"underline" }}>change</button>}
              </div>
            </div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
        </div>

        <div className="wrap">
          {/* Name prompt - blocks everything until name is set */}
          {namePrompt && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div style={{ background:"#162032", border:"1px solid #1e3a5f", borderRadius:20, padding:28, width:"100%", maxWidth:400, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)" }} />
                <div style={{ fontSize:20, fontWeight:900, color:"#f0f6ff", marginBottom:6 }}>👋 Welcome!</div>
                <div style={{ fontSize:13, color:"#64748b", marginBottom:16 }}>Please enter your name before using the app.</div>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if(e.key === "Enter" && nameInput.trim()) { setStaffName(nameInput.trim()); localStorage.setItem("preop_staff_name", nameInput.trim()); supabase.auth.updateUser({ data: { full_name: nameInput.trim() } }); setNamePrompt(false); }}}
                  placeholder="Enter your name"
                  className="inp"
                  style={{ marginBottom:12 }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if(!nameInput.trim()) return;
                    setStaffName(nameInput.trim());
                    localStorage.setItem("preop_staff_name", nameInput.trim());
                    // Also save to Supabase user metadata
                    supabase.auth.updateUser({ data: { full_name: nameInput.trim() } });
                    setNamePrompt(false);
                  }}
                  className="btn btn-ac"
                  style={{ width:"100%" }}
                >
                  Let's Go →
                </button>
              </div>
            </div>
          )}

          {/* Order request button */}
          <button onClick={() => { setOrderPinOpen(true); setOrderPin(""); setOrderPinErr(false); }} className="order-btn">
            📦 Request Order
          </button>

          {/* Search and filter */}
          <div className="search-row">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="search-inp" />
            <button onClick={() => setLowOnly(v => !v)} className={"low-btn " + (lowOnly ? "low-on" : "low-off")}>
              {lowOnly ? `LOW (${lowCount})` : `Low: ${lowCount}`}
            </button>
          </div>

          <div className="count-badge">Showing {filtered.length} of {items.length} items</div>

          {loading ? (
            [1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height:120, marginBottom:10 }} />)
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#334155" }}>
              {items.length === 0 ? "No items in Pre-Op/PACU yet. Add items via Add/Manage Items → Add to Area." : "No items match your search."}
            </div>
          ) : filtered.map(item => {
            const isLow = item.low_level > 0 && item.on_hand <= item.low_level;
            const mode = txMode[item.item_id] || "USE";
            const qty = txQty[item.item_id] || 1;
            return (
              <div key={item.item_id} className={"item-card " + (isLow ? "low" : "ok")}>
                <div className="item-name">{item.name}</div>
                <div className="item-meta">
                  {item.vendor || "—"} · {item.reference_number ? `Ref: ${item.reference_number}` : "No ref"} · {item.unit || "—"}
                </div>
                {item.alert_note && (
                  <div style={{ fontSize:11, color:"#fcd34d", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:6, padding:"3px 8px", marginBottom:8 }}>⚡ {item.alert_note}</div>
                )}
                <div className="pills">
                  <div className="pill">PAR <span>{item.par_level}</span></div>
                  <div className="pill">LOW <span>{item.low_level}</span></div>
                  {isLow && <span style={{ fontSize:10, fontWeight:800, color:"#fca5a5", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:4, padding:"2px 8px" }}>LOW STOCK</span>}
                </div>

                {msg?.id === item.item_id && (
                  <div className={msg.type === "ok" ? "ok-msg" : "err-msg"}>{msg.text}</div>
                )}

                <div className="oh-row">
                  <div style={{ fontSize:13, color:"#64748b" }}>Contact receiving to update counts</div>
                  <div className={"oh-badge " + (isLow?"low":"ok")}>
                    <div className={"oh-num " + (isLow?"low":"ok")}>{item.on_hand}</div>
                    <div className="oh-unit">on hand</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if(!staffName.trim()) { setNamePrompt(true); return; }
                    try {
                      const res = await fetch("/api/restock-request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          item_id: item.item_id,
                          item_name: item.name,
                          requested_by: staffName,
                          requested_from: "Pre-Op/PACU",
                        }),
                      });
                      const json = await res.json();
                      if (!json.ok) throw new Error(json.error);
                      setMsg({ id: item.item_id, type:"ok", text: `🔄 Restock requested for ${item.name}` });
                      setTimeout(() => setMsg(null), 3000);
                    } catch(e:any) {
                      setMsg({ id: item.item_id, type:"err", text: e?.message ?? "Failed to request restock" });
                      setTimeout(() => setMsg(null), 3000);
                    }
                  }}
                  style={{ width:"100%", marginTop:8, background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.3)", borderRadius:8, color:"#d8b4fe", padding:"8px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:700 }}
                >
                  🔄 Request Restock from Receiving
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIN modal */}
      {orderPinOpen && (
        <div className="modal-overlay" onClick={() => setOrderPinOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔐 Enter PIN to Order</div>
            <input type="password" inputMode="numeric" value={orderPin} onChange={e => { setOrderPin(e.target.value.replace(/\D/g,"").slice(0,4)); setOrderPinErr(false); }} placeholder="Enter PIN" className="inp" style={{ letterSpacing:8, textAlign:"center", fontSize:20 }} />
            {orderPinErr && <div className="err-msg">Wrong PIN</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-ac" style={{ flex:1 }} onClick={() => { if(orderPin === ORDER_PIN) { setOrderPinOpen(false); setOrderOpen(true); setOrderMsg(null); } else setOrderPinErr(true); }}>Continue</button>
              <button className="btn btn-gh" onClick={() => setOrderPinOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Order request modal */}
      {orderOpen && (
        <div className="modal-overlay" onClick={() => setOrderOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📦 Request Order</div>
            {orderMsg && <div className={orderMsg.type === "ok" ? "ok-msg" : "err-msg"}>{orderMsg.text}</div>}
            <div style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>Select items and enter quantities to request:</div>
            {items.map(item => {
              const selected = orderItems[item.item_id] !== undefined;
              const isLow = item.low_level > 0 && item.on_hand <= item.low_level;
              return (
                <div key={item.item_id} className="order-item-row">
                  <input type="checkbox" checked={selected} onChange={e => {
                    if(e.target.checked) setOrderItems(p => ({...p, [item.item_id]: 1}));
                    else setOrderItems(p => { const n = {...p}; delete n[item.item_id]; return n; });
                  }} style={{ width:18, height:18, cursor:"pointer", flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f0f6ff", wordBreak:"break-word" }}>{item.name}</div>
                    <div style={{ fontSize:11, color:"#64748b" }}>{item.vendor || "—"} · {item.reference_number || "—"} · On Hand: {item.on_hand}</div>
                    {item.alert_note && <div style={{ fontSize:10, color:"#fcd34d", marginTop:2 }}>⚡ {item.alert_note}</div>}
                    {isLow && <span style={{ fontSize:9, fontWeight:800, color:"#fca5a5", background:"rgba(239,68,68,0.15)", borderRadius:4, padding:"1px 5px" }}>LOW</span>}
                  </div>
                  {selected && (
                    <input type="number" min={1} value={orderItems[item.item_id] || 1} onChange={e => setOrderItems(p => ({...p, [item.item_id]: Math.max(1, Number(e.target.value)||1)}))} style={{ width:60, borderRadius:8, border:"1px solid #1e3a5f", background:"#111827", color:"#f0f6ff", padding:"6px 8px", fontSize:14, fontWeight:800, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  )}
                </div>
              );
            })}
            <div style={{ marginTop:16, display:"flex", gap:8 }}>
              <button className="btn btn-ac" style={{ flex:1 }} onClick={sendOrderRequest} disabled={ordering}>
                {ordering ? "Sending…" : `📤 Send Request (${Object.keys(orderItems).length} items)`}
              </button>
              <button className="btn btn-gh" onClick={() => setOrderOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
