"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";
const OR_ROOMS = ["OR 1","OR 2","OR 3","OR 4","OR 5","OR 6","OR 7","OR 8"];

type PrefCard = { id: string; surgeon: string; procedure_name: string; specialty: string | null; };
type CardItem = { id: string; item_id: string; qty: number; item_name?: string; unit?: string | null; };
type CaseSession = { id: string; session_name: string; pref_card_id: string; or_room: string | null; case_date: string; posted_at: string | null; posted_by: string | null; is_posted: boolean; surgeon?: string; procedure_name?: string; };

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
  .inp-sel{appearance:none;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#111827;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:700px;max-height:88vh;overflow-y:auto;}
  .modal-title{font-size:17px;font-weight:900;color:#f0f6ff;margin-bottom:6px;}
  .modal-sub{font-size:12px;color:#64748b;margin-bottom:16px;}
  .item-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #1e3a5f;}
  .item-name{font-size:14px;font-weight:700;color:#f0f6ff;flex:1;word-break:break-word;}
  .ok-msg{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;text-align:center;font-weight:700;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .or-card{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;}
  .or-card.done{border-color:rgba(16,185,129,0.3);opacity:0.7;}
  .or-badge{display:inline-flex;align-items:center;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;color:#93c5fd;margin-bottom:6px;}
  .date-btn{border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;white-space:nowrap;}
  .date-on{background:rgba(59,130,246,0.2);color:#93c5fd;border-color:rgba(59,130,246,0.4);}
  .date-off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .hist-card{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .skel{animation:pulse 1.5s infinite;background:#162032;border-radius:10px;}
`;

export default function PrefCardsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"Schedule"|"Cards"|"History">("Schedule");
  const [cards, setCards] = useState<PrefCard[]>([]);
  const [cardItems, setCardItems] = useState<Record<string, CardItem[]>>({});
  const [allItems, setAllItems] = useState<{id:string;name:string;unit:string|null}[]>([]);
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [history, setHistory] = useState<CaseSession[]>([]);
  const [historyItems, setHistoryItems] = useState<Record<string, any[]>>({});
  const [expandedHist, setExpandedHist] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSession, setSelectedSession] = useState<CaseSession | null>(null);
  const [pullChecked, setPullChecked] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PrefCard|null>(null);
  const [newOR, setNewOR] = useState("OR 1");
  const [newCardId, setNewCardId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [addingCase, setAddingCase] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [staffName, setStaffName] = useState("Admin");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      if(data.session?.user) setStaffName(data.session.user.user_metadata?.full_name || data.session.user.email || "Admin");
    });
    loadCards();
    loadAllItems();
    loadSessions();
  }, []);

  async function loadCards() {
    setLoading(true);
    const { data } = await supabase.from("pref_cards").select("id,surgeon,procedure_name,specialty").eq("is_active", true).order("surgeon");
    if (data) setCards(data as PrefCard[]);
    setLoading(false);
  }

  async function loadSessions() {
    const { data } = await supabase.from("case_pull_sessions").select("*").order("case_date", {ascending:false}).order("or_room");
    if (data) {
      // Enrich with card info
      const cardIds = [...new Set(data.map((s:any) => s.pref_card_id).filter(Boolean))];
      if (cardIds.length > 0) {
        const { data: cardData } = await supabase.from("pref_cards").select("id,surgeon,procedure_name").in("id", cardIds);
        const cardMap = cardData ? Object.fromEntries(cardData.map((c:any) => [c.id, c])) : {};
        setSessions(data.map((s:any) => ({...s, surgeon: cardMap[s.pref_card_id]?.surgeon, procedure_name: cardMap[s.pref_card_id]?.procedure_name})));
      } else {
        setSessions(data);
      }
    }
  }

  async function loadCardItems(cardId: string) {
    if (cardItems[cardId]) { return; }
    const { data } = await supabase.from("pref_card_items").select("id,item_id,qty").eq("pref_card_id", cardId);
    if (!data || data.length === 0) { setCardItems(prev => ({...prev, [cardId]: []})); return; }
    const ids = data.map((i:any) => i.item_id);
    const { data: items } = await supabase.from("items").select("id,name,unit").in("id", ids);
    const itemMap = items ? Object.fromEntries(items.map((i:any) => [i.id, i])) : {};
    const enriched = data.map((r:any) => ({...r, item_name: itemMap[r.item_id]?.name ?? "Unknown", unit: itemMap[r.item_id]?.unit ?? null}));
    setCardItems(prev => ({...prev, [cardId]: enriched}));
  }

  async function loadAllItems() {
    const { data } = await supabase.from("items").select("id,name,unit").eq("is_active", true).order("name");
    if (data) setAllItems(data);
  }

  async function loadHistory() {
    const { data } = await supabase.from("case_pull_sessions").select("*").eq("is_posted", true).order("posted_at", {ascending:false}).limit(100);
    if (data) {
      const cardIds = [...new Set(data.map((s:any) => s.pref_card_id).filter(Boolean))];
      if (cardIds.length > 0) {
        const { data: cardData } = await supabase.from("pref_cards").select("id,surgeon,procedure_name").in("id", cardIds);
        const cardMap = cardData ? Object.fromEntries(cardData.map((c:any) => [c.id, c])) : {};
        setHistory(data.map((s:any) => ({...s, surgeon: cardMap[s.pref_card_id]?.surgeon, procedure_name: cardMap[s.pref_card_id]?.procedure_name})));
      } else setHistory(data);
    }
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

  async function addCase() {
    if (!newCardId) { setMsg({type:"err",text:"Select a pref card."}); return; }
    setAddingCase(true);
    try {
      const card = cards.find(c => c.id === newCardId);
      const { error } = await supabase.from("case_pull_sessions").insert({
        pref_card_id: newCardId,
        session_name: `${card?.surgeon} — ${card?.procedure_name}`,
        or_room: newOR,
        case_date: newDate,
        is_posted: false,
      });
      if (error) throw error;
      setShowAddCase(false);
      setNewCardId("");
      await loadSessions();
      setMsg({type:"ok",text:"Case added to schedule!"}); setTimeout(()=>setMsg(null),2000);
    } catch(e:any) { setMsg({type:"err",text:e?.message??"Failed"}); }
    setAddingCase(false);
  }

  async function openCase(session: CaseSession) {
    setSelectedSession(session);
    await loadCardItems(session.pref_card_id);
    const items = cardItems[session.pref_card_id] || [];
    const checked: Record<string,boolean> = {};
    items.forEach(i => { checked[i.id] = false; });
    setPullChecked(checked);
  }

  async function postPull() {
    if (!selectedSession) return;
    await loadCardItems(selectedSession.pref_card_id);
    const items = (cardItems[selectedSession.pref_card_id] || []).filter(i => pullChecked[i.id]);
    if (!items.length) { setMsg({type:"err",text:"Check at least one item."}); return; }
    if (!confirm(`Mark ${items.length} item${items.length>1?"s":""} as used and deduct from inventory?`)) return;
    setPosting(true);
    try {
      await supabase.from("case_pull_sessions").update({
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: staffName,
      }).eq("id", selectedSession.id);

      for (const item of items) {
        await supabase.from("case_pull_session_items").insert({ session_id: selectedSession.id, item_id: item.item_id, qty_pulled: item.qty });
        await supabase.rpc("use_stock", { p_item_id: item.item_id, p_area_id: MAIN_SUPPLY_ID, p_qty: item.qty });
        await supabase.from("audit_log").insert({ staff_name: staffName, action: "CASE_PULL", area_name: selectedSession.or_room || "Main Sterile Supply", details: `Card=${selectedSession.surgeon} Procedure=${selectedSession.procedure_name} OR=${selectedSession.or_room} Item=${item.item_name} Qty=${item.qty}` });
      }

      setMsg({type:"ok",text:`✅ Done! ${items.length} items deducted from inventory.`});
      setSelectedSession(null);
      setPullChecked({});
      await loadSessions();
    } catch(e:any) { setMsg({type:"err",text:e?.message??"Failed"}); }
    setPosting(false);
    setTimeout(()=>setMsg(null),4000);
  }

  async function deleteCase(id: string) {
    if (!confirm("Remove this case from the schedule?")) return;
    await supabase.from("case_pull_sessions").delete().eq("id", id);
    await loadSessions();
  }

  async function addItemToCard() {
    if (!selectedCard || !addItemId) return;
    setAdding(true);
    try {
      await supabase.from("pref_card_items").insert({ pref_card_id: selectedCard.id, item_id: addItemId, qty: addQty, sort_order: (cardItems[selectedCard.id]?.length??0)+1 });
      setShowAddItem(false); setAddItemId(""); setAddQty(1); setItemSearch("");
      delete cardItems[selectedCard.id];
      await loadCardItems(selectedCard.id);
      setMsg({type:"ok",text:"Item added!"}); setTimeout(()=>setMsg(null),2000);
    } catch(e:any) { setMsg({type:"err",text:e?.message??"Failed"}); }
    setAdding(false);
  }

  async function removeItemFromCard(itemId: string) {
    if (!confirm("Remove this item from the card?")) return;
    await supabase.from("pref_card_items").delete().eq("id", itemId);
    if (selectedCard) { delete cardItems[selectedCard.id]; await loadCardItems(selectedCard.id); }
  }

  const todaySessions = useMemo(() => sessions.filter(s => s.case_date === selectedDate), [sessions, selectedDate]);
  const uniqueDates = useMemo(() => [...new Set(sessions.map(s => s.case_date))].sort((a,b) => b.localeCompare(a)), [sessions]);
  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  function formatDate(d: string) { return new Date(d+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); }
  function formatTime(ts: string) { return new Date(ts).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div className="header-title">🩺 Pref Cards</div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
          <div className="tabs">
            {(["Schedule","Cards","History"] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); if(tab==="History") loadHistory(); }} className={"tab "+(activeTab===tab?"tab-on":"tab-off")}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="wrap">
          {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}

          {/* SCHEDULE TAB */}
          {activeTab === "Schedule" && (
            <>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{borderRadius:8,border:"1px solid #1e3a5f",background:"#111827",color:"#f0f6ff",padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
                <button onClick={()=>{setShowAddCase(true);setNewDate(selectedDate);setNewCardId("");setNewOR("OR 1");}} className="btn btn-ac btn-sm">+ Add Case</button>
              </div>

              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {uniqueDates.slice(0,7).map(d => (
                  <button key={d} onClick={()=>setSelectedDate(d)} className={"date-btn "+(selectedDate===d?"date-on":"date-off")}>{new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</button>
                ))}
              </div>

              <div style={{fontSize:13,fontWeight:800,color:"#64748b",marginBottom:10}}>{formatDate(selectedDate)}</div>

              {todaySessions.length === 0 ? (
                <div style={{textAlign:"center",padding:40,color:"#334155"}}>No cases scheduled for this day.<br/>Tap + Add Case to schedule one.</div>
              ) : todaySessions.map(session => (
                <div key={session.id} className={"or-card"+(session.is_posted?" done":"")} onClick={()=>!session.is_posted&&openCase(session)}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1}}>
                      <div className="or-badge">{session.or_room || "No OR"}</div>
                      <div style={{fontSize:14,fontWeight:800,color:"#f0f6ff",marginBottom:2}}>{session.surgeon || "—"}</div>
                      <div style={{fontSize:12,color:"#64748b"}}>{session.procedure_name || "—"}</div>
                      {session.is_posted && <div style={{fontSize:11,color:"#6ee7b7",marginTop:4}}>✅ Done · Posted by {session.posted_by} · {session.posted_at ? formatTime(session.posted_at) : ""}</div>}
                      {!session.is_posted && <div style={{fontSize:11,color:"#3b82f6",marginTop:4}}>Tap to use items →</div>}
                    </div>
                    {!session.is_posted && (
                      <button onClick={e=>{e.stopPropagation();deleteCase(session.id);}} className="btn btn-red btn-sm">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* CARDS TAB */}
          {activeTab === "Cards" && (
            <>
              {loading ? [1,2,3].map(i=><div key={i} className="skel" style={{height:90,marginBottom:12}}/>) :
              cards.map(card => {
                const isOpen = selectedCard?.id === card.id;
                const items = cardItems[card.id];
                return (
                  <div key={card.id} className="card">
                    <div className="card-title">{card.surgeon}</div>
                    <div className="card-sub">{card.procedure_name}{card.specialty?` · ${card.specialty}`:""}</div>
                    {isOpen && items ? (
                      <>
                        {items.length === 0 ? <div style={{fontSize:12,color:"#334155",marginBottom:8}}>No items yet.</div> : items.map(item=>(
                          <div key={item.id} className="item-row">
                            <div style={{flex:1}}>
                              <div className="item-name">{item.item_name}</div>
                              <div style={{fontSize:11,color:"#64748b"}}>Qty: {item.qty} · {item.unit||"Each"}</div>
                            </div>
                            <button onClick={()=>removeItemFromCard(item.id)} className="btn btn-red btn-sm">Remove</button>
                          </div>
                        ))}
                        <div className="btn-row">
                          <button onClick={()=>{setShowAddItem(true);setItemSearch("");setAddItemId("");}} className="btn btn-gh btn-sm">➕ Add Item</button>
                          <button onClick={()=>setSelectedCard(null)} className="btn btn-gh btn-sm">Close</button>
                        </div>
                      </>
                    ) : (
                      <div className="btn-row">
                        <button onClick={()=>{setSelectedCard(card);if(!cardItems[card.id])loadCardItems(card.id);}} className="btn btn-gh btn-sm">View / Edit Items</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* HISTORY TAB */}
          {activeTab === "History" && (
            <>
              {history.length === 0 ? <div style={{textAlign:"center",padding:40,color:"#334155"}}>No history yet.</div> :
              history.map(h => (
                <div key={h.id} className="hist-card" onClick={()=>loadHistoryItems(h.id)}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start",justifyContent:"space-between"}}>
                    <div>
                      {h.or_room && <div className="or-badge">{h.or_room}</div>}
                      <div style={{fontSize:13,fontWeight:800,color:"#f0f6ff",marginTop:4}}>{h.surgeon||h.session_name}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{h.procedure_name||""}</div>
                      <div style={{fontSize:11,color:"#334155",marginTop:4}}>{h.case_date ? formatDate(h.case_date) : ""} · By {h.posted_by||"—"}</div>
                    </div>
                    <div style={{fontSize:11,color:"#64748b",flexShrink:0}}>{expandedHist===h.id?"▲":"▼"}</div>
                  </div>
                  {expandedHist===h.id && historyItems[h.id] && (
                    <div style={{marginTop:10,borderTop:"1px solid #1e3a5f",paddingTop:10}}>
                      {historyItems[h.id].map((item,i)=>(
                        <div key={i} style={{fontSize:12,color:"#94a3b8",padding:"3px 0"}}>• {item.name} × {item.qty_pulled} {item.unit||"Each"}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Use Items Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={()=>setSelectedSession(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{selectedSession.or_room} — {selectedSession.surgeon}</div>
            <div className="modal-sub">{selectedSession.procedure_name} · Check items that were used</div>
            {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}
            {(cardItems[selectedSession.pref_card_id]||[]).map(item=>(
              <div key={item.id} className="item-row">
                <input type="checkbox" checked={pullChecked[item.id]??false} onChange={e=>setPullChecked(p=>({...p,[item.id]:e.target.checked}))} style={{width:22,height:22,cursor:"pointer",flexShrink:0}} />
                <div style={{flex:1,opacity:pullChecked[item.id]?1:0.5}}>
                  <div className="item-name">{item.item_name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>Qty: {item.qty} · {item.unit||"Each"}</div>
                </div>
              </div>
            ))}
            {(cardItems[selectedSession.pref_card_id]||[]).length === 0 && (
              <div style={{textAlign:"center",padding:20,color:"#334155"}}>No items on this card yet. Go to Cards tab to add items.</div>
            )}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={postPull} disabled={posting||!Object.values(pullChecked).some(Boolean)} className="btn btn-green" style={{flex:1,padding:14,fontSize:14}}>
                {posting?"Processing…":`✅ Used (${Object.values(pullChecked).filter(Boolean).length} items)`}
              </button>
              <button onClick={()=>setSelectedSession(null)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Case Modal */}
      {showAddCase && (
        <div className="modal-overlay" onClick={()=>setShowAddCase(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">+ Add Case to Schedule</div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Date</div>
            <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className="inp" />
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>OR Room</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {OR_ROOMS.map(or=>(
                <button key={or} type="button" onClick={()=>setNewOR(or)} style={{borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:newOR===or?"rgba(59,130,246,0.25)":"#1e2d42",color:newOR===or?"#93c5fd":"#64748b",border:newOR===or?"1px solid rgba(59,130,246,0.5)":"1px solid #1e3a5f"}}>{or}</button>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Pref Card</div>
            <select value={newCardId} onChange={e=>setNewCardId(e.target.value)} className="inp inp-sel">
              <option value="">Select pref card…</option>
              {cards.map(c=><option key={c.id} value={c.id}>{c.surgeon} — {c.procedure_name}</option>)}
            </select>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={addCase} disabled={addingCase||!newCardId} className="btn btn-ac" style={{flex:1}}>{addingCase?"Adding…":"Add to Schedule"}</button>
              <button onClick={()=>setShowAddCase(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item to Card Modal */}
      {showAddItem && selectedCard && (
        <div className="modal-overlay" onClick={()=>setShowAddItem(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Add Item to {selectedCard.surgeon}&apos;s Card</div>
            <input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Search items…" className="inp" autoFocus />
            <div style={{maxHeight:260,overflowY:"auto",marginBottom:12}}>
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
