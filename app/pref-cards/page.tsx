"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

type PrefCard = { id: string; surgeon: string; procedure_name: string; specialty: string | null; };
type CardItem = { id: string; item_id: string; qty: number; item_name?: string; unit?: string | null; };
type InventoryItem = { id: string; name: string; unit: string | null; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 0 80px;}
  .header{background:linear-gradient(135deg,#162032,#111827);border-bottom:1px solid #1e3a5f;padding:16px;position:sticky;top:0;z-index:40;}
  .header-top{display:flex;align-items:center;justify-content:space-between;max-width:700px;margin:0 auto;}
  .header-title{font-size:20px;font-weight:900;color:#f0f6ff;}
  .back-btn{background:#1e2d42;border:1px solid #1e3a5f;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#94a3b8;cursor:pointer;font-family:inherit;}
  .wrap{max-width:700px;margin:0 auto;padding:16px;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:12px;}
  .card-title{font-size:16px;font-weight:900;color:#f0f6ff;margin-bottom:2px;}
  .card-sub{font-size:12px;color:#64748b;margin-bottom:12px;}
  .btn{border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-green{background:rgba(16,185,129,0.2);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .btn-red{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-sm{padding:6px 12px;font-size:11px;}
  .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#162032;color:#f0f6ff;padding:11px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#111827;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:700px;max-height:88vh;overflow-y:auto;}
  .modal-title{font-size:17px;font-weight:900;color:#f0f6ff;margin-bottom:6px;}
  .modal-sub{font-size:12px;color:#64748b;margin-bottom:16px;}
  .item-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #1e3a5f;}
  .item-name{font-size:14px;font-weight:700;color:#f0f6ff;flex:1;word-break:break-word;}
  .ok-msg{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:12px;text-align:center;font-weight:700;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .skel{animation:pulse 1.5s infinite;background:#162032;border-radius:10px;}
`;

export default function PrefCardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<PrefCard[]>([]);
  const [cardItems, setCardItems] = useState<Record<string, CardItem[]>>({});
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<PrefCard | null>(null);
  const [showPull, setShowPull] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [pullChecked, setPullChecked] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);
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
  }, []);

  async function loadCards() {
    setLoading(true);
    const { data } = await supabase.from("pref_cards").select("id,surgeon,procedure_name,specialty").eq("is_active", true).order("surgeon");
    if (data) setCards(data as PrefCard[]);
    setLoading(false);
  }

  async function loadCardItems(cardId: string) {
    const { data } = await supabase.from("pref_card_items").select("id,item_id,qty").eq("pref_card_id", cardId);
    if (!data || data.length === 0) { setCardItems(prev => ({...prev, [cardId]: []})); return; }
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
    if (data) setAllItems(data as InventoryItem[]);
  }

  function openPull(card: PrefCard) {
    const items = cardItems[card.id] || [];
    const checked: Record<string,boolean> = {};
    items.forEach(i => { checked[i.id] = false; });
    setPullChecked(checked);
    setSelectedCard(card);
    setMsg(null);
  }

  async function postPull() {
    if (!selectedCard) return;
    const items = (cardItems[selectedCard.id] || []).filter(i => pullChecked[i.id]);
    if (!items.length) { setMsg({type:"err", text:"Check at least one item."}); return; }
    setPosting(true);
    try {
      const { data: session, error: sErr } = await supabase.from("case_pull_sessions").insert({
        pref_card_id: selectedCard.id,
        session_name: `${selectedCard.surgeon} — ${selectedCard.procedure_name}`,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: staffName,
      }).select().single();
      if (sErr) throw sErr;

      for (const item of items) {
        await supabase.from("case_pull_session_items").insert({ session_id: session.id, item_id: item.item_id, qty_pulled: item.qty });
        await supabase.rpc("use_stock", { p_item_id: item.item_id, p_area_id: MAIN_SUPPLY_ID, p_qty: item.qty });
        await supabase.from("audit_log").insert({
          staff_name: staffName,
          action: "CASE_PULL",
          area_name: "Main Sterile Supply",
          details: `Card=${selectedCard.surgeon} Procedure=${selectedCard.procedure_name} Item=${item.item_name} Qty=${item.qty}`,
        });
      }
      setMsg({type:"ok", text:`✅ Done! ${items.length} items taken out of inventory.`});
      setShowPull(false);
    } catch(e:any) {
      setMsg({type:"err", text: e?.message ?? "Failed"});
    }
    setPosting(false);
  }

  async function addItemToCard() {
    if (!selectedCard || !addItemId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("pref_card_items").insert({
        pref_card_id: selectedCard.id,
        item_id: addItemId,
        qty: addQty,
        sort_order: (cardItems[selectedCard.id]?.length ?? 0) + 1,
      });
      if (error) throw error;
      setShowAddItem(false);
      setAddItemId(""); setAddQty(1); setItemSearch("");
      await loadCardItems(selectedCard.id);
      setMsg({type:"ok", text:"Item added!"});
      setTimeout(() => setMsg(null), 2000);
    } catch(e:any) {
      setMsg({type:"err", text: e?.message ?? "Failed"});
    }
    setAdding(false);
  }

  async function removeItem(itemId: string) {
    if (!selectedCard || !confirm("Remove this item from the card?")) return;
    await supabase.from("pref_card_items").delete().eq("id", itemId);
    await loadCardItems(selectedCard.id);
  }

  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div className="header-title">🩺 Preference Cards</div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
        </div>

        <div className="wrap">
          {msg && !showPull && !showAddItem && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}

          {loading ? [1,2,3].map(i=><div key={i} className="skel" style={{height:90,marginBottom:12}}/>) : (
            cards.length === 0 ? (
              <div style={{textAlign:"center",padding:40,color:"#334155"}}>No preference cards yet. Create one in Admin Table.</div>
            ) : cards.map(card => {
              const items = cardItems[card.id];
              const isOpen = selectedCard?.id === card.id && !showPull;
              return (
                <div key={card.id} className="card">
                  <div className="card-title">{card.surgeon}</div>
                  <div className="card-sub">{card.procedure_name}{card.specialty ? ` · ${card.specialty}` : ""}</div>

                  {isOpen && items && (
                    <>
                      {items.length === 0 ? (
                    <div style={{fontSize:12,color:"#334155",marginBottom:8}}>No items on this card yet.</div>
                  ) : (
                    <>
                      <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Check items that were used:</div>
                      {items.map(item => (
                        <div key={item.id} className="item-row">
                          <input type="checkbox" checked={pullChecked[item.id] ?? false} onChange={e => setPullChecked(p => ({...p, [item.id]: e.target.checked}))} style={{width:22,height:22,cursor:"pointer",flexShrink:0}} />
                          <div style={{flex:1,opacity:pullChecked[item.id]?1:0.5}}>
                            <div className="item-name">{item.item_name}</div>
                            <div style={{fontSize:11,color:"#64748b"}}>Qty: {item.qty} · {item.unit || "Each"}</div>
                          </div>
                          <button onClick={() => removeItem(item.id)} className="btn btn-red btn-sm">Remove</button>
                        </div>
                      ))}
                      {Object.values(pullChecked).some(Boolean) && (
                        <button
                          onClick={async () => {
                            const count = Object.values(pullChecked).filter(Boolean).length;
                            if(!confirm(`Mark ${count} item${count>1?"s":""} as used and deduct from inventory?`)) return;
                            await postPull();
                            setPullChecked({});
                          }}
                          disabled={posting}
                          className="btn btn-green"
                          style={{width:"100%",marginTop:12,padding:14,fontSize:14}}
                        >
                          {posting ? "Processing…" : `✅ Used (${Object.values(pullChecked).filter(Boolean).length} items)`}
                        </button>
                      )}
                    </>
                  )}
                      <div className="btn-row">
                        <button onClick={() => { setShowAddItem(true); setItemSearch(""); setAddItemId(""); }} className="btn btn-gh btn-sm">➕ Add Item</button>
                        <button onClick={() => setSelectedCard(null)} className="btn btn-gh btn-sm">Close</button>
                      </div>
                    </>
                  )}

                  {!isOpen && (
                    <div className="btn-row">
                      <button onClick={() => { setSelectedCard(card); if(!cardItems[card.id]) loadCardItems(card.id); }} className="btn btn-gh btn-sm">View / Edit</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pull Modal */}
      {showPull && selectedCard && (
        <div className="modal-overlay" onClick={() => setShowPull(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🏥 {selectedCard.surgeon}</div>
            <div className="modal-sub">{selectedCard.procedure_name} · Check what was used · tap Used to deduct</div>
            {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}
            {(cardItems[selectedCard.id] || []).map(item => (
              <div key={item.id} className="item-row">
                <input type="checkbox" checked={pullChecked[item.id] ?? true} onChange={e => setPullChecked(p => ({...p, [item.id]: e.target.checked}))} style={{width:22,height:22,cursor:"pointer",flexShrink:0}} />
                <div style={{flex:1, opacity: pullChecked[item.id] ? 1 : 0.35}}>
                  <div className="item-name">{item.item_name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>Qty: {item.qty} · {item.unit || "Each"}</div>
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:20}}>
              <button onClick={postPull} disabled={posting} className="btn btn-green" style={{flex:1,fontSize:15,padding:14}}>
                {posting ? "Processing…" : `✅ Used (${Object.values(pullChecked).filter(Boolean).length} items)`}
              </button>
              <button onClick={() => setShowPull(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && selectedCard && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">➕ Add Item to Card</div>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search items…" className="inp" autoFocus />
            <div style={{maxHeight:280,overflowY:"auto",marginBottom:12}}>
              {filteredItems.slice(0,50).map(item => (
                <div key={item.id} onClick={() => setAddItemId(item.id)} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",background:addItemId===item.id?"rgba(59,130,246,0.15)":"transparent",border:addItemId===item.id?"1px solid rgba(59,130,246,0.4)":"1px solid transparent",marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f0f6ff"}}>{item.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{item.unit || "Each"}</div>
                </div>
              ))}
            </div>
            {addItemId && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Default qty per case</div>
                <input type="number" min={1} value={addQty} onChange={e => setAddQty(Math.max(1,Number(e.target.value)||1))} style={{width:80,borderRadius:8,border:"1px solid #1e3a5f",background:"#111827",color:"#f0f6ff",padding:"8px 10px",fontSize:16,fontWeight:800,textAlign:"center",fontFamily:"inherit",outline:"none"}} />
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={addItemToCard} disabled={!addItemId||adding} className="btn btn-ac" style={{flex:1}}>{adding?"Adding…":"Add to Card"}</button>
              <button onClick={() => setShowAddItem(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
