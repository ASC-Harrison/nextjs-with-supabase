"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Area = { id: string; name: string };
type Item = { id: string; name: string; reference_number: string | null; vendor: string | null; category: string | null; unit: string | null; };

const SUPPLY_SOURCE_OPTIONS = [
  { value: "VENDOR", label: "Outside Vendor" },
  { value: "HOSPITAL", label: "Main Hospital (Baxter)" },
  { value: "BOTH", label: "Both - Hospital + Vendor" },
];

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:600px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .title{font-size:26px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:20px;}
  .tab-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;}
  .tab-btn{border-radius:12px;padding:14px;font-size:14px;font-weight:800;cursor:pointer;border:1.5px solid;transition:all 0.18s;text-align:center;font-family:inherit;}
  .tab-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;box-shadow:0 2px 12px rgba(59,130,246,0.3);}
  .tab-btn.off{background:#162032;color:#64748b;border-color:#1e3a5f;}
  .tab-btn.off:hover{color:#f0f6ff;border-color:#3b82f6;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6);}
  .card-title{font-size:15px;font-weight:800;color:#f0f6ff;margin-bottom:4px;letter-spacing:-0.3px;}
  .card-sub{font-size:12px;color:#64748b;margin-bottom:16px;line-height:1.5;}
  .lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;display:block;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;transition:all 0.18s;margin-bottom:10px;}
  .inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
  .inp::placeholder{color:#334155;}
  .inp-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .btn{border-radius:10px;padding:13px 18px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:6px;}
  .btn-ac{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;box-shadow:0 4px 16px rgba(59,130,246,0.3);}
  .btn-ac:hover:not(:disabled){box-shadow:0 6px 24px rgba(59,130,246,0.45);transform:translateY(-1px);}
  .btn-ac:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
  .btn-full{width:100%;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px;font-size:13px;color:#6ee7b7;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px;font-size:13px;color:#fca5a5;margin-bottom:14px;}
  .divider{height:1px;background:#1e3a5f;margin:16px 0;}
  .suggest-list{background:#111827;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;margin-bottom:10px;max-height:200px;overflow-y:auto;}
  .suggest-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid #1e3a5f;transition:background 0.1s;}
  .suggest-item:last-child{border-bottom:none;}
  .suggest-item:hover{background:#1e2d42;}
  .suggest-name{font-size:13px;font-weight:700;color:#f0f6ff;}
  .suggest-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .selected-item{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:12px 14px;margin-bottom:10px;}
  .selected-name{font-size:14px;font-weight:700;color:#f0f6ff;}
  .selected-meta{font-size:11px;color:#64748b;margin-top:3px;}
  .clear-btn{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#fca5a5;padding:3px 10px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700;margin-top:6px;}
`;

export default function ItemsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"new" | "area">("new");
  const [areas, setAreas] = useState<Area[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState<{type:"ok"|"err";text:string}|null>(null);
  const [loading, setLoading] = useState(false);

  // New item fields
  const [name, setName] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [itemNumber, setItemNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [lowLevel, setLowLevel] = useState("");
  const [price, setPrice] = useState("");
  const [supplySource, setSupplySource] = useState("VENDOR");
  const [notes, setNotes] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  // Add to area fields
  const [itemSearch, setItemSearch] = useState("");
  const [itemSuggestions, setItemSuggestions] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item|null>(null);
  const [selectedArea, setSelectedArea] = useState("");
  const [areaPar, setAreaPar] = useState("");
  const [areaLow, setAreaLow] = useState("");
  const [areaOnHand, setAreaOnHand] = useState("0");

  useEffect(() => {
    supabase.from("storage_areas").select("id,name").order("name").then(({data}) => {
      if (data) setAreas(data as Area[]);
    });
    supabase.from("items").select("id,name,reference_number,vendor,category,unit").eq("is_active",true).order("name").then(({data}) => {
      if (data) setAllItems(data as Item[]);
    });
  }, []);

  useEffect(() => {
    if (!itemSearch.trim() || itemSearch.length < 2) { setItemSuggestions([]); return; }
    const q = itemSearch.toLowerCase();
    setItemSuggestions(allItems.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.reference_number||"").toLowerCase().includes(q) ||
      (i.vendor||"").toLowerCase().includes(q)
    ).slice(0, 8));
  }, [itemSearch, allItems]);

  function showMsg(type:"ok"|"err", text:string) {
    setMsg({type,text});
    setTimeout(() => setMsg(null), 5000);
  }

  function resetNewItem() {
    setName(""); setRefNumber(""); setItemNumber(""); setVendor(""); setCategory("");
    setUnit(""); setParLevel(""); setLowLevel(""); setPrice("");
    setSupplySource("VENDOR"); setNotes(""); setExpirationDate("");
  }

  async function handleCreateItem() {
    if (!name.trim()) return showMsg("err", "Item name is required.");
    setLoading(true);
    try {
      const res = await fetch("/api/items/create-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          reference_number: refNumber.trim() || null,
          item_number: itemNumber.trim() || null,
          vendor: vendor.trim() || null,
          category: category.trim() || null,
          unit: unit.trim() || null,
          par_level: parLevel ? Number(parLevel) : 0,
          low_level: lowLevel ? Number(lowLevel) : 0,
          price: price ? Number(price) : null,
          supply_source: supplySource,
          notes: notes.trim() || null,
          expiration_date: expirationDate || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showMsg("ok", `✅ "${name.trim()}" added to the system successfully!`);
      resetNewItem();
      const { data: refreshed } = await supabase.from("items").select("id,name,reference_number,vendor,category,unit").eq("is_active",true).order("name");
      if (refreshed) setAllItems(refreshed as Item[]);
    } catch (e:any) {
      showMsg("err", e?.message ?? "Failed to create item.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToArea() {
    if (!selectedItem) return showMsg("err", "Select an item first.");
    if (!selectedArea) return showMsg("err", "Select a storage area.");
    setLoading(true);
    try {
      const res = await fetch("/api/items/add-to-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_area_id: selectedArea,
          item_id: selectedItem.id,
          on_hand: Number(areaOnHand) || 0,
          par_level: areaPar ? Number(areaPar) : 0,
          low_level: areaLow ? Number(areaLow) : 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const areaName = areas.find(a => a.id === selectedArea)?.name ?? selectedArea;
      showMsg("ok", `✅ "${selectedItem.name}" added to ${areaName}! Go to that area to verify it shows up.`);
      setSelectedItem(null); setItemSearch(""); setAreaPar(""); setAreaLow(""); setAreaOnHand("0"); setSelectedArea("");
    } catch (e:any) {
      showMsg("err", e?.message ?? "Failed to add item to area.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="title">Item Management</div>
          <div className="sub">Add new items to the system or assign existing items to storage areas.</div>

          <div className="tab-row">
            <button onClick={() => setActiveTab("new")} className={`tab-btn ${activeTab==="new"?"on":"off"}`}>➕ New Item</button>
            <button onClick={() => setActiveTab("area")} className={`tab-btn ${activeTab==="area"?"on":"off"}`}>📦 Add to Area</button>
          </div>

          {msg && <div className={msg.type==="ok"?"ok":"err"}>{msg.text}</div>}

          {/* New Item Tab */}
          {activeTab === "new" && (
            <div className="card">
              <div className="card-title">Add New Item to System</div>
              <div className="card-sub">Creates the item with zero counts. Add it to storage areas separately.</div>

              <label className="lbl">Item Name *</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="inp" placeholder="e.g., Arthrex Suture Anchor 5mm" />

              <div className="g2">
                <div>
                  <label className="lbl">Reference #</label>
                  <input value={refNumber} onChange={e=>setRefNumber(e.target.value)} className="inp" placeholder="e.g., AR-1234" />
                </div>
                <div>
                  <label className="lbl">Item Number</label>
                  <input value={itemNumber} onChange={e=>setItemNumber(e.target.value)} className="inp" placeholder="e.g., SPD-001" />
                </div>
              </div>

              <div className="g2">
                <div>
                  <label className="lbl">Vendor</label>
                  <input value={vendor} onChange={e=>setVendor(e.target.value)} className="inp" placeholder="e.g., Arthrex" />
                </div>
                <div>
                  <label className="lbl">Category</label>
                  <input value={category} onChange={e=>setCategory(e.target.value)} className="inp" placeholder="e.g., Implants" />
                </div>
              </div>

              <label className="lbl">Unit</label>
              <input value={unit} onChange={e=>setUnit(e.target.value)} className="inp" placeholder="e.g., Each, Bx" />

              <div className="g2">
                <div>
                  <label className="lbl">PAR Level</label>
                  <input value={parLevel} onChange={e=>setParLevel(e.target.value.replace(/\D/g,""))} className="inp" placeholder="0" inputMode="numeric" />
                </div>
                <div>
                  <label className="lbl">Low Level</label>
                  <input value={lowLevel} onChange={e=>setLowLevel(e.target.value.replace(/\D/g,""))} className="inp" placeholder="0" inputMode="numeric" />
                </div>
              </div>

              <div className="g2">
                <div>
                  <label className="lbl">Price ($)</label>
                  <input value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9.]/g,""))} className="inp" placeholder="0.00" inputMode="decimal" />
                </div>
                <div>
                  <label className="lbl">Supply Source</label>
                  <select value={supplySource} onChange={e=>setSupplySource(e.target.value)} className="inp inp-sel">
                    {SUPPLY_SOURCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <label className="lbl">Expiration Date</label>
              <input value={expirationDate} onChange={e=>setExpirationDate(e.target.value)} className="inp" type="date" style={{marginBottom:10}} />

              <label className="lbl">Notes</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="inp" style={{minHeight:70,resize:"vertical"}} placeholder="Any additional notes…" />

              <button onClick={handleCreateItem} disabled={loading||!name.trim()} className="btn btn-ac btn-full">
                {loading ? "Adding…" : "➕ Add Item to System"}
              </button>
            </div>
          )}

          {/* Add to Area Tab */}
          {activeTab === "area" && (
            <div className="card">
              <div className="card-title">Add Item to Storage Area</div>
              <div className="card-sub">Assign an existing item to a storage area with its own par and low levels.</div>

              <label className="lbl">Search Item</label>
              <input
                value={itemSearch}
                onChange={e=>{setItemSearch(e.target.value);setSelectedItem(null);}}
                className="inp"
                placeholder="Type item name, ref #, or vendor…"
              />
              {itemSuggestions.length > 0 && (
                <div className="suggest-list">
                  {itemSuggestions.map(item => (
                    <div key={item.id} className="suggest-item" onClick={()=>{setSelectedItem(item);setItemSearch("");setItemSuggestions([]);}}>
                      <div className="suggest-name">{item.name}</div>
                      <div className="suggest-meta">{item.vendor||"—"} · Ref: {item.reference_number||"—"} · {item.unit||"—"}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedItem && (
                <div className="selected-item">
                  <div className="selected-name">✅ {selectedItem.name}</div>
                  <div className="selected-meta">{selectedItem.vendor||"—"} · Ref: {selectedItem.reference_number||"—"}</div>
                  <button className="clear-btn" onClick={()=>setSelectedItem(null)}>Change item</button>
                </div>
              )}

              <div className="divider" />

              <label className="lbl">Storage Area *</label>
              <select value={selectedArea} onChange={e=>setSelectedArea(e.target.value)} className="inp inp-sel">
                <option value="">Select area…</option>
                {areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <div className="g2">
                <div>
                  <label className="lbl">On Hand</label>
                  <input value={areaOnHand} onChange={e=>setAreaOnHand(e.target.value.replace(/\D/g,""))} className="inp" placeholder="0" inputMode="numeric" />
                </div>
                <div>
                  <label className="lbl">PAR Level</label>
                  <input value={areaPar} onChange={e=>setAreaPar(e.target.value.replace(/\D/g,""))} className="inp" placeholder="0" inputMode="numeric" />
                </div>
              </div>

              <label className="lbl">Low Level</label>
              <input value={areaLow} onChange={e=>setAreaLow(e.target.value.replace(/\D/g,""))} className="inp" placeholder="0" inputMode="numeric" />

              <button onClick={handleAddToArea} disabled={loading||!selectedItem||!selectedArea} className="btn btn-ac btn-full">
                {loading ? "Adding…" : "📦 Add to Storage Area"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
