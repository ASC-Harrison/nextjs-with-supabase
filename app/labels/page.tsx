"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = {
  id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  barcode: string | null;
};

const APP_URL = "https://nextjs-with-supabase-gamma-rosy.vercel.app";

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .title{font-size:26px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:24px;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;}
  .label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;transition:all 0.18s;margin-bottom:10px;}
  .inp:focus{border-color:#3b82f6;}
  .inp::placeholder{color:#334155;}
  .btn{border-radius:10px;padding:11px 18px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;display:inline-flex;align-items:center;gap:6px;justify-content:center;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-ac:hover{background:#2563eb;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-gh:hover{color:#f0f6ff;}
  .btn-full{width:100%;}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .item-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #1e3a5f;}
  .item-row:last-child{border-bottom:none;}
  .item-name{font-size:13px;font-weight:700;color:#f0f6ff;word-break:break-word;}
  .item-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .selected-count{font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:12px;}
  .size-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
  .size-btn{border-radius:10px;padding:10px 8px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid;transition:all 0.18s;text-align:center;font-family:inherit;}
  .size-btn.on{background:#3b82f6;color:#fff;border-color:#3b82f6;}
  .size-btn.off{background:#1e2d42;color:#64748b;border-color:#1e3a5f;}
  .size-btn.off:hover{color:#f0f6ff;border-color:#3b82f6;}
  .suggest-list{background:#111827;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;margin-bottom:10px;max-height:220px;overflow-y:auto;}
  .suggest-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid #1e3a5f;transition:background 0.1s;}
  .suggest-item:last-child{border-bottom:none;}
  .suggest-item:hover{background:#1e2d42;}
  .suggest-name{font-size:13px;font-weight:700;color:#f0f6ff;}
  .suggest-meta{font-size:11px;color:#64748b;margin-top:2px;}
  .selected-item{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:10px 14px;margin-bottom:8px;}
  .remove-btn{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#fca5a5;padding:3px 10px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700;flex-shrink:0;}

  /* Print styles */
  @media print {
    body{margin:0;background:#fff;}
    .no-print{display:none!important;}
    .print-page{display:block!important;}
    .label-grid-30{display:grid;grid-template-columns:repeat(3,1fr);gap:0;width:100%;}
    .label-grid-10{display:grid;grid-template-columns:repeat(2,1fr);gap:0;width:100%;}
    .label-grid-6{display:grid;grid-template-columns:repeat(2,1fr);gap:0;width:100%;}
    .label-cell{border:1px dashed #ccc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:Arial,sans-serif;page-break-inside:avoid;}
    .label-cell-30{padding:6px 4px;min-height:72pt;}
    .label-cell-10{padding:8px;min-height:144pt;}
    .label-cell-6{padding:10px;min-height:216pt;}
    .label-name{font-weight:700;color:#000;word-break:break-word;line-height:1.2;}
    .label-name-30{font-size:7pt;margin-top:4px;}
    .label-name-10{font-size:9pt;margin-top:6px;}
    .label-name-6{font-size:11pt;margin-top:8px;}
    .label-ref{color:#555;line-height:1.2;}
    .label-ref-30{font-size:6pt;}
    .label-ref-10{font-size:8pt;margin-top:2px;}
    .label-ref-6{font-size:9pt;margin-top:3px;}
    .label-vendor{color:#777;}
    .label-vendor-30{font-size:5.5pt;}
    .label-vendor-10{font-size:7pt;margin-top:1px;}
    .label-vendor-6{font-size:8pt;margin-top:2px;}
    .qr-img-30{width:48pt;height:48pt;}
    .qr-img-10{width:80pt;height:80pt;}
    .qr-img-6{width:110pt;height:110pt;}
  }
  .print-page{display:none;}
`;

// Simple QR code using Google Charts API
function qrUrl(text: string, size: number) {
  return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;
}

const SIZES = [
  { id: "30", label: "30 per page", desc: "Small · Avery 8160", cols: 3 },
  { id: "10", label: "10 per page", desc: "Medium · Avery 5163", cols: 2 },
  { id: "6",  label: "6 per page",  desc: "Large · Full sheet", cols: 2 },
];

export default function LabelsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item[]>([]);
  const [size, setSize] = useState("30");
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("items").select("id,name,reference_number,vendor,barcode").eq("is_active", true).order("name").then(({ data }) => {
      if (data) setItems(data as Item[]);
    });
  }, []);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    setSuggestions(items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.reference_number||"").toLowerCase().includes(q) ||
      (i.vendor||"").toLowerCase().includes(q)
    ).slice(0, 8));
  }, [search, items]);

  function addItem(item: Item) {
    if (!selected.find(s => s.id === item.id)) setSelected(prev => [...prev, item]);
    setSearch(""); setSuggestions([]);
  }

  function removeItem(id: string) { setSelected(prev => prev.filter(s => s.id !== id)); }

  function addAll() {
    const q = search.toLowerCase();
    const filtered = q.length >= 2 ? suggestions : items.slice(0, 50);
    filtered.forEach(item => { if (!selected.find(s => s.id === item.id)) setSelected(prev => [...prev, item]); });
    setSearch(""); setSuggestions([]);
  }

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 300);
  }

  const qrSize = size === "30" ? 96 : size === "10" ? 160 : 220;
  const gridClass = `label-grid-${size}`;
  const cellClass = `label-cell label-cell-${size}`;
  const nameClass = `label-name label-name-${size}`;
  const refClass  = `label-ref label-ref-${size}`;
  const vendClass = `label-vendor label-vendor-${size}`;
  const qrClass   = `qr-img-${size}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Print area — hidden on screen, shown when printing */}
      <div ref={printRef} className="print-page">
        <div className={gridClass}>
          {selected.map((item) => (
            <div key={item.id} className={cellClass}>
              <img
                src={qrUrl(`${APP_URL}/inventory?scan=${encodeURIComponent(item.barcode||item.id)}`, qrSize)}
                className={qrClass}
                alt="QR"
              />
              <div className={nameClass}>{item.name}</div>
              {item.reference_number && <div className={refClass}>Ref: {item.reference_number}</div>}
              {item.vendor && <div className={vendClass}>{item.vendor}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Main UI */}
      <div className="root no-print">
        <div className="wrap">
          <button onClick={() => window.history.back()} className="back-btn">← Back</button>
          <div className="title">QR Label Generator</div>
          <div className="sub">Search items, select them, choose a size and print.</div>

          {/* Search */}
          <div className="card">
            <label className="label">Search Items</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type item name, ref #, or vendor…"
              className="inp"
            />
            {suggestions.length > 0 && (
              <>
                <div className="suggest-list">
                  {suggestions.map(item => (
                    <div key={item.id} className="suggest-item" onClick={() => addItem(item)}>
                      <div className="suggest-name">{item.name}</div>
                      <div className="suggest-meta">{item.vendor||"—"} · Ref: {item.reference_number||"—"}</div>
                    </div>
                  ))}
                </div>
                <button onClick={addAll} className="btn btn-gh btn-full" style={{fontSize:12}}>Add all {suggestions.length} results</button>
              </>
            )}
          </div>

          {/* Selected items */}
          {selected.length > 0 && (
            <div className="card">
              <div className="selected-count">{selected.length} item{selected.length !== 1 ? "s" : ""} selected</div>
              {selected.map(item => (
                <div key={item.id} className="selected-item">
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f0f6ff",wordBreak:"break-word"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{item.vendor||"—"} · Ref: {item.reference_number||"—"}</div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="remove-btn">Remove</button>
                </div>
              ))}
              <button onClick={() => setSelected([])} className="btn btn-gh btn-full" style={{marginTop:8,fontSize:12}}>Clear all</button>
            </div>
          )}

          {/* Label size */}
          <div className="card">
            <label className="label">Label Size</label>
            <div className="size-grid">
              {SIZES.map(s => (
                <button key={s.id} onClick={() => setSize(s.id)} className={`size-btn ${size === s.id ? "on" : "off"}`}>
                  <div>{s.label}</div>
                  <div style={{fontSize:10,fontWeight:400,marginTop:3,opacity:0.7}}>{s.desc}</div>
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:"#334155",lineHeight:1.6}}>
              Use <strong style={{color:"#475569"}}>Avery 8160</strong> for 30/page · <strong style={{color:"#475569"}}>Avery 5163</strong> for 10/page · Any paper for 6/page
            </div>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={selected.length === 0 || printing}
            className="btn btn-ac btn-full"
            style={{fontSize:15,padding:"14px"}}
          >
            {printing ? "Preparing…" : `🖨️ Print ${selected.length} Label${selected.length !== 1 ? "s" : ""}`}
          </button>

          {selected.length === 0 && (
            <div style={{textAlign:"center",fontSize:12,color:"#334155",marginTop:12}}>
              Search and select items above to generate labels.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
