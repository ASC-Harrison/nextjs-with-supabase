"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

type PrefCard = { id: string; surgeon: string; procedure_name: string; specialty: string | null; notes: string | null; is_active: boolean; };
type CardItem = { id: string; pref_card_id: string; item_id: string; qty: number; notes: string | null; item_name?: string; unit?: string | null; on_hand?: number; };
type InventoryItem = { id: string; name: string; unit: string | null; on_hand: number; };

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
  .card-title{font-size:15px;font-weight:800;color:#f0f6ff;margin-bottom:2px;}
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
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#111827;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:700px;max-height:88vh;overflow-y:auto;}
  .modal-title{font-size:17px;font-weight:900;color:#f0f6ff;margin-bottom:16px;}
  .item-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e3a5f;}
  .item-name{font-size:13px;font-weight:700;color:#f0f6ff;flex:1;word-break:break-word;}
  .item-sub{font-size:11px;color:#64748b;}
  .qty-inp{width:56px;border-radius:8px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:6px 8px;font-size:14px;font-weight:800;text-align:center;font-family:inherit;outline:none;}
  .ok-msg{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px;font-size:12px;color:#6ee7b7;margin-bottom:10px;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;font-size:12px;color:#fca5a5;margin-bottom:10px;}
  .badge{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;}
  .badge-low{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .section-title{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin:16px 0 8px;}
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
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPull, setShowPull] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [pullQtys, setPullQtys] = useState<Record<string, number>>({});
  const [pullChecked, setPullChecked] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      if(data.session?.user) {
        setStaffName(data.session.user.user_metadata?.full_name || data.session.user.email || "Admin");
      }
    });
    loadCards();
    loadInventory();
  }, []);

  async function loadCards() {
    setLoading(true);
    const { data } = await supabase.from("pref_cards").select("*").eq("is_active", true).order("surgeon");
    if (data) setCards(data as PrefCard[]);
    setLoading(false);
  }

  async function loadCardItems(cardId: string) {
    const { data } = await supabase.from("pref_card_items").select("*").eq("pref_card_id", cardId).order("sort_order");
    if (data && data.length > 0) {
      const ids = data.map((i:any) => i.item_id);
      const { data: items } = await supabase.from("items").select("id,name,unit").in("id", ids);
      const { data: inv } = await supabase.from("storage_inventory").select("item_id,on_hand").eq("storage_area_id", MAIN_SUPPLY_ID).in("item_id", ids);
      const itemMap = items ? Object.fromEntries(items.map((i:any) => [i.id, i])) : {};
      const invMap = inv ? Object.fromEntries(inv.map((i:any) => [i.item_id, i.on_hand])) : {};
      const enriched = data.map((r:any) => ({
        ...r,
        item_name: itemMap[r.item_id]?.name ?? "Unknown",
        unit: itemMap[r.item_id]?.unit ?? null,
        on_hand: invMap[r.item_id] ?? 0,
      }));
      setCardItems(prev => ({ ...prev, [cardId]: enriched }));
    } else {
      setCardItems(prev => ({ ...prev, [cardId]: [] }));
    }
  }

  async function loadInventory() {
    const { data: items } = await supabase.from("items").select("id,name,unit").eq("is_active", true).order("name");
    const { data: inv } = await supabase.from("storage_inventory").select("item_id,on_hand").eq("storage_area_id", MAIN_SUPPLY_ID);
    if (items) {
      const invMap = inv ? Object.fromEntries(inv.map((i:any) => [i.item_id, i.on_hand])) : {};
      setAllItems(items.map((i:any) => ({ ...i, on_hand: invMap[i.id] ?? 0 })));
    }
  }

  function openCard(card: PrefCard) {
    setSelectedCard(card);
    if (!cardItems[card.id]) loadCardItems(card.id);
  }

  async function addItemToCard() {
    if (!selectedCard || !addItemId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("pref_card_items").insert({
        pref_card_id: selectedCard.id,
        item_id: addItemId,
        qty: addQty,
        notes: addNotes || null,
        sort_order: (cardItems[selectedCard.id]?.length ?? 0) + 1,
      });
      if (error) throw error;
      setMsg({ type:"ok", text:"Item added to card!" });
      setAddItemId(""); setAddQty(1); setAddNotes("");
      setShowAddItem(false);
      await loadCardItems(selectedCard.id);
    } catch(e:any) {
      setMsg({ type:"err", text: e?.message ?? "Failed to add item" });
    }
    setAdding(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function removeItemFromCard(itemId: string) {
    if (!selectedCard || !confirm("Remove this item from the card?")) return;
    await supabase.from("pref_card_items").delete().eq("id", itemId);
    await loadCardItems(selectedCard.id);
  }

  function openPull(card: PrefCard) {
    setSelectedCard(card);
    const items = cardItems[card.id] || [];
    const qtys: Record<string,number> = {};
    const checked: Record<string,boolean> = {};
    items.forEach(i => { qtys[i.id] = i.qty; checked[i.id] = true; });
    setPullQtys(qtys);
    setPullChecked(checked);
    setShowPull(true);
    setMsg(null);
  }

  async function postPull() {
    if (!selectedCard) return;
    const items = cardItems[selectedCard.id] || [];
    const toPost = items.filter(i => pullChecked[i.id]);
    if (!toPost.length) { setMsg({ type:"err", text:"Select at least one item to pull." }); return; }
    setPosting(true);
    try {
      // Create pull session
      const { data: session, error: sessionErr } = await supabase.from("case_pull_sessions").insert({
        pref_card_id: selectedCard.id,
        session_name: `${selectedCard.surgeon} — ${selectedCard.procedure_name}`,
        is_posted: true,
        posted_at: new Date().toISOString(),
        posted_by: staffName,
      }).select().single();
      if (sessionErr) throw sessionErr;

      // Insert session items and deduct from inventory
      for (const item of toPost) {
        const qty = pullQtys[item.id] || item.qty;
        await supabase.from("case_pull_session_items").insert({
          session_id: session.id,
          item_id: item.item_id,
          qty_pulled: qty,
        });
        // Deduct from main supply
        await supabase.rpc("use_stock", {
          p_item_id: item.item_id,
          p_area_id: MAIN_SUPPLY_ID,
          p_qty: qty,
        });
        // Log audit
        await supabase.from("audit_log").insert({
          staff_name: staffName,
          action: "CASE_PULL",
          area_name: "Main Sterile Supply",
          details: `Card=${selectedCard.surgeon} Procedure=${selectedCard.procedure_name} Item=${item.item_name} Qty=${qty}`,
        });
      }

      setMsg({ type:"ok", text:`✅ Pull posted! ${toPost.length} items deducted from inventory.` });
      setShowPull(false);
      await loadCardItems(selectedCard.id);
      await loadInventory();
    } catch(e:any) {
      setMsg({ type:"err", text: e?.message ?? "Failed to post pull" });
    }
    setPosting(false);
  }

  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));
  const selectedCardItems = selectedCard ? (cardItems[selectedCard.id] || []) : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="header">
          <div className="header-top">
            <div className="header-title">📋 Preference Cards</div>
            <button onClick={() => router.push("/")} className="back-btn">← Home</button>
          </div>
        </div>

        <div className="wrap">
          {msg && !showPull && !showAddItem && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}

          {loading ? (
            [1,2,3].map(i => <div key={i} className="skel" style={{height:100,marginBottom:12}} />)
          ) : cards.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#334155"}}>No preference cards yet. Create one in the Admin Table.</div>
          ) : cards.map(card => (
            <div key={card.id} className="card">
              <div className="card-title">{card.surgeon}</div>
              <div className="card-sub">{card.procedure_name}{card.specialty ? ` · ${card.specialty}` : ""}</div>
              {selectedCard?.id === card.id && (
                <>
                  <div className="section-title">Items on Card ({selectedCardItems.length})</div>
                  {selectedCardItems.length === 0 ? (
                    <div style={{fontSize:12,color:"#334155",marginBottom:10}}>No items yet — tap Add Item to get started.</div>
                  ) : selectedCardItems.map(item => (
                    <div key={item.id} className="item-row">
                      <div style={{flex:1}}>
                        <div className="item-name">{item.item_name}</div>
                        <div className="item-sub">Qty: {item.qty} · {item.unit || "Each"} · On Hand: <strong style={{color: item.on_hand < item.qty ? "#fca5a5" : "#6ee7b7"}}>{item.on_hand}</strong></div>
                        {item.on_hand < item.qty && <span className="badge badge-low">LOW STOCK</span>}
                      </div>
                      <button onClick={() => removeItemFromCard(item.id)} className="btn btn-red btn-sm">Remove</button>
                    </div>
                  ))}
                  <div className="btn-row">
                    <button onClick={() => { setShowAddItem(true); setItemSearch(""); }} className="btn btn-gh btn-sm">➕ Add Item</button>
                    {selectedCardItems.length > 0 && (
                      <button onClick={() => openPull(card)} className="btn btn-green">🏥 Start Case Pull</button>
                    )}
                    <button onClick={() => setSelectedCard(null)} className="btn btn-gh btn-sm">Close</button>
                  </div>
                </>
              )}
              {selectedCard?.id !== card.id && (
                <div className="btn-row">
                  <button onClick={() => openCard(card)} className="btn btn-gh btn-sm">View Card</button>
                  {(cardItems[card.id]?.length ?? 0) > 0 && (
                    <button onClick={() => { openCard(card); setTimeout(() => openPull(card), 300); }} className="btn btn-green btn-sm">🏥 Pull</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && selectedCard && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">➕ Add Item to {selectedCard.surgeon}&apos;s Card</div>
            {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search items…" className="inp" />
            <div style={{maxHeight:300,overflowY:"auto",marginBottom:12}}>
              {filteredItems.slice(0,50).map(item => (
                <div key={item.id} onClick={() => setAddItemId(item.id)} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",background:addItemId===item.id?"rgba(59,130,246,0.15)":"transparent",border:addItemId===item.id?"1px solid rgba(59,130,246,0.4)":"1px solid transparent",marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f0f6ff"}}>{item.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{item.unit || "Each"} · On Hand: {item.on_hand}</div>
                </div>
              ))}
            </div>
            {addItemId && (
              <>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:6}}>Default Qty for this Case</label>
                <input type="number" min={1} value={addQty} onChange={e => setAddQty(Math.max(1,Number(e.target.value)||1))} className="inp" style={{width:100}} />
              </>
            )}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={addItemToCard} disabled={!addItemId||adding} className="btn btn-ac" style={{flex:1}}>
                {adding ? "Adding…" : "Add to Card"}
              </button>
              <button onClick={() => setShowAddItem(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Pull Session Modal */}
      {showPull && selectedCard && (
        <div className="modal-overlay" onClick={() => setShowPull(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🏥 Case Pull — {selectedCard.surgeon}</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{selectedCard.procedure_name} · Uncheck items not used · Adjust qty if needed</div>
            {msg && <div className={msg.type==="ok"?"ok-msg":"err-msg"}>{msg.text}</div>}
            {selectedCardItems.map(item => (
              <div key={item.id} className="item-row">
                <input type="checkbox" checked={pullChecked[item.id] ?? true} onChange={e => setPullChecked(p => ({...p, [item.id]:e.target.checked}))} style={{width:18,height:18,cursor:"pointer",flexShrink:0}} />
                <div style={{flex:1,opacity:pullChecked[item.id]?1:0.4}}>
                  <div className="item-name">{item.item_name}</div>
                  <div className="item-sub">{item.unit || "Each"} · On Hand: <strong style={{color:item.on_hand<(pullQtys[item.id]||item.qty)?"#fca5a5":"#6ee7b7"}}>{item.on_hand}</strong></div>
                  {item.on_hand < (pullQtys[item.id]||item.qty) && <span className="badge badge-low">NOT ENOUGH STOCK</span>}
                </div>
                {pullChecked[item.id] && (
                  <input type="number" min={1} value={pullQtys[item.id]||item.qty} onChange={e => setPullQtys(p => ({...p, [item.id]:Math.max(1,Number(e.target.value)||1)}))} className="qty-inp" />
                )}
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={postPull} disabled={posting} className="btn btn-green" style={{flex:1}}>
                {posting ? "Posting…" : `✅ Post Pull (${Object.values(pullChecked).filter(Boolean).length} items)`}
              </button>
              <button onClick={() => setShowPull(false)} className="btn btn-gh">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
