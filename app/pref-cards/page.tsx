"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";
const DOCTORS = ["All", "Dr. Cutler", "Dr. Sidani", "Dr. Smith"];

type PrefCard = { id: string; surgeon: string; procedure_name: string; specialty: string | null; };
type CardItem = { id: string; item_id: string; qty: number; item_name?: string; unit?: string | null; };
type PullHistory = { id: string; session_name: string; posted_at: string; posted_by: string; item_count?: number; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 0 80px;}
  .header{background:linear-gradient(135deg,#162032,#111827);border-bottom:1px solid #1e3a5f;padding:16px;position:sticky;top:0;z-index:40;}
  .header-top{display:flex;align-items:center;justify-content:space-between;max-width:700px;margin:0 auto;margin-bottom:12px;}
  .header-title{font-size:20px;font-weight:900;color:#f0f6ff;}
  .back-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#94a3b8;cursor:pointer;font-family:inherit;}
  .tabs{display:flex;gap:6px;max-width:700px;margin:0 auto;overflow-x:auto;padding-bottom:2px;}
  .tab{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;white-space:nowrap;}
  .tab-on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .tab-off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .wrap{max-width:700px;margin:0 auto;padding:16px;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:12px;}
  .card-title{font-size:15px;font-weight:900;color:#f0f6ff;margin-bottom:2px;}
  .card-sub{font-size:11px;color:#64748b;margin-bottom:10px;}
  .btn{border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-green{background:rgba(16,185,129,0.2);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .btn-red{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-sm{padding:6px 12px;font-size:11px;}
  .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#162032;color:#f0f6ff;padding:11px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#111827;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:700px;max-height:88vh;overflow-y:auto;}
  .modal-title{font-size:17px;font-weight:900;color:#f0f6ff;margin-bottom:6px;}
  .modal-sub{font-size:12px;color:#64748b;margin-bottom:16px;}
  .item-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #1e3a5f;}
  .item-name{font-size:14px;font-weight:700;color:#f0f6ff;flex:1;word-break:break-word;}
  .ok-msg{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;text-align:center;font-weight:700;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .hist-card{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:10px;}
  .hist-title{font-size:13px;font-weight:800;color:#f0f6ff;margin-bottom:4px;}
  .hist-meta{font-size:11px;color:#64748b;line-height:1.6;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .skel{animation:pulse 1.5s infinite;background:#162032;border-radius:10px;}
`;

export default function PrefCardsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [cards, setCards] = useState<PrefCard[]>([]);
  const [cardItems, setCardItems] = useState<Record<string, CardItem[]>>({});
  const [allItems, setAllItems] = useState<{id:string;name:string;unit:string|null}[]>([]);
  const [history, setHistory] = useState<PullHistory[]>([]);
  const [historyItems, setHistoryItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PrefCard | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [pullChecked, setPullChecked] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [pullOR, setPullOR] = useState("");
  const OR_ROOMS = ["OR 1", "OR 2", "OR 3", "OR 4", "OR 5", "OR 6", "OR 7", "OR 8"];
  const [expandedHist, setExpandedHist] = useState<string|null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      if(data.session?.user) setStaffName(data.session.user.user_metadata?.full_name || data.session.user.email || "Admin");
    });
    loadCards();
    loadAllItems();
  }, []);

  useEffect(() => {
    if (activeTab === "History") loadHistory();
  }, [activeTab]);

  async function loadCards() {
    setLoading(true);
    const { data } = await supabase.from("pref_cards").select("id,surgeon,procedure_name,specialty").eq("is_active", true).order("surgeon");
    if (data) setCards(data as PrefCard[]);
    setLoading(false);
  }

  async function loadCardItems(cardId: string) {
    const { data } = await supabase.from("pref_card_items").select("id,item_id,qty").eq("pref_card_id", cardId);
    if (!data || data.length === 0) { setCardItems(prev => ({...prev, [cardId]: []})); setPullChecked({}); return; }
    const ids = data.map((i:any) => i.item_id);
    const { data: items } = await supabase.from("items").select("id,name,unit").in("id", ids);
    const itemMap = items ? Object.fromEntries(items.map((i:any) => [i.id, i])) : {};
    const enriched = data.map((r:any) => ({...r, item_name: itemMap[r.item_id]?.name ?? "Unknown", unit: itemMap[r.item_id]?.unit ?? null}));
    setCardItems(prev => ({...prev, [cardId]: enriched}));
    const checked: Record<string,boolean> = {};
    enriched.forEach((i:any) => { checked[i.id] = false; });
    setPullChecked(checked);
  }

  async function loadAllItems() {
    const { data } = await supabase.from("items").select("id,name,unit").eq("is_active", true).order("name");
    if (data) setAllItems(data);
  }

  async function loadHistory() {
    setHistLoading(true);
    const { data } = await supabase.from("case_pull_sessions").select("id,session_name,posted_at,posted_by").eq("is_posted", true).order("posted_at", {ascending:false}).limit(100);
    if (data) {
      // Get item counts per session
      const ids = data.map((s:any) => s.id);
      const { data: items } = await supabase.from("case_pull_session_items").select("session_id").in("session_id", ids);
      const countMap: Record<string,number> = {};
      items?.forEach((i:any) => { countMap[i.session_id] = (countMap[i.session_id]||0)+1; });
      setHistory(data.map((s:any) => ({...s, item_count: countMap[s.id]||0})));
    }
    setHistLoading(false);
  }

  async function loadHistoryItems(sessionId: string) {
    if (historyItems[sessionId]) { setExpandedHist(expandedHist===sessionId?null:sessionId); return; }
    const { data } = await supabase.from("case_pull_session_items").select("item_id,qty_pulled").eq("session_id", sessionId);
    if (data && data.length > 0) {
      const ids = data.map((i:any) => i.item_id);
      const { data: items } = await supabase.from("items").select("id,name,unit").in("id", ids);
      const itemMap = items ? Object.fromEntries(items.map((i:any) => [i.id, i])) : {};
      setHistoryItems(prev => ({...prev, [sessionId]: data.map((r:any) => ({...r, name: itemMap[r.item_id]?.name, unit: itemMap[r.item_id]?.unit}))}));
    }
    setExpandedHist(sessionId);
  }

  async function postPull() {
    if (!selectedCard) return;
    const items = (cardItems[selectedCard.id] || []).filter(i => pullChecked[i.id]);
    if (!items.length) { setMsg({type:"err", text:"Check at least one item."}); return; }
    if (!confirm(`Mark ${items.length} item${items.length>1?"s":""} as used and deduct from inventory?`)) return;
    setPosting(true);
    try {
      const sessionName = `${selectedCard.surgeon} — ${selectedCard.procedure_name}${pullOR ? ` · ${pullOR}` : ""}`;
      const { data: session, error: sErr } = await supabase.from("case_pull_sessions").insert({
        pref_card_id: selectedCard.id,
        session_name: sessionName,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: staffName,
      }).select().single();
      if (sErr) throw sErr;
      for (const item of items) {
        await supabase.from("case_pull_session_items").insert({ session_id: session.id, item_id: item.item_id, qty_pulled: item.qty });
        await supabase.rpc("use_stock", { p_item_id: item.item_id, p_area_id: MAIN_SUPPLY_ID, p_qty: item.qty });
        await supabase.from("audit_log").insert({ staff_name: staffName, action: "CASE_PULL", area_name: pullOR || "Main Sterile Supply", details: `Card=${selectedCard.surgeon} Procedure=${selectedCard.procedure_name}${pullOR?` OR=${pullOR}`:""} Item=${item.item_name} Qty=${item.qty}` });
      }
      setMsg({type:"ok", text:`✅ Done! ${items.length} items deducted from inventory.`});
      setPullChecked({});
      setPullOR("");
      setSelectedCard(null);
    } catch(e:any) { setMsg({type:"err", text: e?.message ?? "Failed"}); }
    setPosting(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function addItemToCard() {
    if (!selectedCard || !addItemId) return;
    setAdding(true);
    try {
      await supabase.from("pref_card_items").insert({ pref_card_id: selectedCard.id, item_id: addItemId, qty: addQty, sort_order: (cardItems[selectedCard.id]?.length ?? 0) + 1 });
      setShowAddItem(false); setAddItemId(""); setAddQty(1); setItemSearch("");
      await loadCardItems(selectedCard.id);
      setMsg({type:"ok", text:"Item added!"}); setTimeout(() => setMsg(null), 2000);
    } catch(e:any) { setMsg({type:"err", text: e?.message ?? "Failed"}); }
    setAdding(false);
  }

  async function removeItem(itemId: string) {
    if (!confirm("Remove this item from the card?")) return;
    await supabase.from("pref_card_items").delete().eq("id", itemId);
    if (selectedCard) await loadCardItems(selectedCard.id);
  }

  const filteredCards = useMemo(() => {
    if (activeTab === "All" || activeTab === "History") return cards;
    return cards.filter(c => c.surgeon.toLowerCase().includes(activeTab.toLowerCase().replace("dr. ","")));
  }, [cards, activeTab]);

  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  function formatDate(ts: string) {
    return new Date(ts).toLocaleString("en-US", {month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div className="header-title">🩺 Preference Cards</div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
          <div className="tabs">
            {[...DOCTORS, "History"].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSelectedCard(null); }} className={"tab " + (activeTab===tab?"tab-on":"tab-off")}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="wrap">
          {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}

          {activeTab === "History" ? (
            <>
              <div style={{fontSize:11,color:"#334155",marginBottom:12}}>Tap a pull to see items used</div>
              {histLoading ? [1,2,3].map(i=><div key={i} className="skel" style={{height:72,marginBottom:10}}/>) :
              history.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#334155"}}>No pull history yet.</div> :
              history.map(h => (
                <div key={h.id} className="hist-card" onClick={() => loadHistoryItems(h.id)} style={{cursor:"pointer"}}>
                  <div className="hist-title">{h.session_name}</div>
                  <div className="hist-meta">
                    {formatDate(h.posted_at)} · By {h.posted_by} · {h.item_count} items used
                  </div>
                  {expandedHist === h.id && historyItems[h.id] && (
                    <div style={{marginTop:10,borderTop:"1px solid #1e3a5f",paddingTop:10}}>
                      {historyItems[h.id].map((item,i) => (
                        <div key={i} style={{fontSize:12,color:"#94a3b8",padding:"3px 0"}}>• {item.name} × {item.qty_pulled} {item.unit||"Each"}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            loading ? [1,2].map(i=><div key={i} className="skel" style={{height:90,marginBottom:12}}/>) :
            filteredCards.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#334155"}}>No cards for this doctor.</div> :
            filteredCards.map(card => {
              const items = cardItems[card.id];
              const isOpen = selectedCard?.id === card.id;
              const checkedCount = isOpen ? Object.values(pullChecked).filter(Boolean).length : 0;
              return (
                <div key={card.id} className="card">
                  <div className="card-title">{card.surgeon}</div>
                  <div className="card-sub">{card.procedure_name}{card.specialty?` · ${card.specialty}`:""}</div>
                  {isOpen && items ? (
                    <>
                      {items.length === 0 ? (
                        <div style={{fontSize:12,color:"#334155",marginBottom:8}}>No items yet — tap Add Item.</div>
                      ) : (
                        <>
                          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Check items that were used:</div>
                          {items.map(item => (
                            <div key={item.id} className="item-row">
                              <input type="checkbox" checked={pullChecked[item.id]??false} onChange={e=>setPullChecked(p=>({...p,[item.id]:e.target.checked}))} style={{width:22,height:22,cursor:"pointer",flexShrink:0}} />
                              <div style={{flex:1,opacity:pullChecked[item.id]?1:0.5}}>
                                <div className="item-name">{item.item_name}</div>
                                <div style={{fontSize:11,color:"#64748b"}}>Qty: {item.qty} · {item.unit||"Each"}</div>
                              </div>
                              <button onClick={()=>removeItem(item.id)} className="btn btn-red btn-sm">Remove</button>
                            </div>
                          ))}
                          {checkedCount > 0 && (
                            <div style={{marginTop:12}}>
                              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Which OR? (optional)</div>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                                {OR_ROOMS.map(or => (
                                  <button key={or} type="button" onClick={() => setPullOR(pullOR===or?"":or)} style={{borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:pullOR===or?"rgba(59,130,246,0.25)":"#1e2d42",color:pullOR===or?"#93c5fd":"#64748b",border:pullOR===or?"1px solid rgba(59,130,246,0.5)":"1px solid #1e3a5f"}}>
                                    {or}
                                  </button>
                                ))}
                              </div>
                              <button onClick={postPull} disabled={posting} className="btn btn-green" style={{width:"100%",padding:14,fontSize:14}}>
                                {posting?"Processing…":`✅ Used (${checkedCount} item${checkedCount>1?"s":""})`}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      <div className="btn-row">
                        <button onClick={()=>{setShowAddItem(true);setItemSearch("");setAddItemId("");}} className="btn btn-gh btn-sm">➕ Add Item</button>
                        <button onClick={()=>setSelectedCard(null)} className="btn btn-gh btn-sm">Close</button>
                      </div>
                    </>
                  ) : (
                    <div className="btn-row">
                      <button onClick={()=>{setSelectedCard(card);if(!cardItems[card.id])loadCardItems(card.id);}} className="btn btn-gh btn-sm">View / Edit</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && selectedCard && (
        <div className="modal-overlay" onClick={()=>setShowAddItem(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Add Item to Card</div>
            <input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Search items…" className="inp" autoFocus />
            <div style={{maxHeight:280,overflowY:"auto",marginBottom:12}}>
              {filteredItems.slice(0,50).map(item=>(
                <div key={item.id} onClick={()=>setAddItemId(item.id)} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",background:addItemId===item.id?"rgba(59,130,246,0.15)":"transparent",border:addItemId===item.id?"1px solid rgba(59,130,246,0.4)":"1px solid transparent",marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f0f6ff"}}>{item.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{item.unit||"Each"}</div>
                </div>
              ))}
            </div>
            {addItemId && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Default qty per case</div>
                <input type="number" min={1} value={addQty} onChange={e=>setAddQty(Math.max(1,Number(e.target.value)||1))} style={{width:80,borderRadius:8,border:"1px solid #1e3a5f",background:"#111827",color:"#f0f6ff",padding:"8px 10px",fontSize:16,fontWeight:800,textAlign:"center",fontFamily:"inherit",outline:"none"}} />
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={addItemToCard} disabled={!addItemId||adding} className="btn btn-ac" style={{flex:1}}>{adding?"Adding…":"Add to Card"}</button>
              <button onClick={()=>setShowAddItem(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
