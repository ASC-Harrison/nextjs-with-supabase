"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Item={id:string;name:string;vendor:string|null;category:string|null;reference_number:string|null;unit:string|null;price:number|null;units_per_box:number|null;price_source:string|null;price_updated_at:string|null};
const money=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD"});
const date=(value:string|null)=>value?new Date(value).toLocaleDateString("en-US",{timeZone:"America/Chicago"}):"—";

export default function CurrentPrices(){
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("ENTERED");
  const [sort,setSort]=useState("NAME");
  const [loadedAt,setLoadedAt]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const {data:auth,error:authError}=await db.auth.getUser();
      if(authError||!auth.user)throw new Error("Please sign in to view current prices.");
      const rows:Item[]=[];
      for(let offset=0;;offset+=500){
        const {data,error:queryError}=await db.from("items").select("id,name,vendor,category,reference_number,unit,price,units_per_box,price_source,price_updated_at").order("id").range(offset,offset+499);
        if(queryError)throw queryError;
        rows.push(...data as Item[]);if(data.length<500)break;
      }
      setItems(rows);setLoadedAt(new Date().toLocaleString("en-US",{timeZone:"America/Chicago"}));
    }catch(e){setError(e instanceof Error?e.message:"Could not load prices.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const positive=items.filter(i=>i.price!==null&&Number(i.price)>0).length;
  const zero=items.filter(i=>i.price!==null&&Number(i.price)===0).length;
  const missing=items.filter(i=>i.price===null).length;
  const q=search.trim().toLowerCase();
  const visible=items.filter(i=>{
    const priced=i.price!==null;
    if(filter==="ENTERED"&&!priced)return false;
    if(filter==="POSITIVE"&&(!priced||Number(i.price)<=0))return false;
    if(filter==="ZERO"&&(!priced||Number(i.price)!==0))return false;
    if(filter==="MISSING"&&priced)return false;
    return !q||[i.name,i.reference_number,i.vendor,i.category].some(v=>v?.toLowerCase().includes(q));
  }).sort((a,b)=>{
    if(sort==="NAME")return a.name.localeCompare(b.name);
    if(a.price===null)return b.price===null?a.name.localeCompare(b.name):1;
    if(b.price===null)return -1;
    return (sort==="HIGH"?Number(b.price)-Number(a.price):Number(a.price)-Number(b.price))||a.name.localeCompare(b.name);
  });
  const total=visible.reduce((s,i)=>s+Number(i.price??0),0);
  function exportCSV(){
    const line=(values:unknown[])=>values.map(v=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",");
    const lines=[line(["Baxter ASC Current Prices","Loaded",loadedAt]),line(["Filter",filter,"Search",search]),line(["Sum of displayed listed prices (each item once)",total]),line(["Item","Reference","Vendor","Category","Inventory unit","Saved price","Price status","Units per package","Calculated price per unit","Price source","Price updated"]),...visible.map(i=>line([i.name,i.reference_number,i.vendor,i.category,i.unit,i.price,i.price===null?"Not entered":Number(i.price)===0?"Zero price":"Price entered",i.units_per_box,i.price!==null&&Number(i.units_per_box)>0?Number(i.price)/Number(i.units_per_box):null,i.price_source,date(i.price_updated_at)]))];
    const url=URL.createObjectURL(new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="ASC-Current-Prices.csv";a.click();URL.revokeObjectURL(url);
  }
  return <main className="prices"><style>{`
    .prices{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:24px 16px 90px;font:15px system-ui}.prices-inner{max-width:1250px;margin:auto}.prices a{color:#93c5fd}.prices h1{font-size:28px;margin:18px 0 8px}.prices p{color:#94a3b8;line-height:1.5}.prices-nav,.prices-actions{display:flex;flex-wrap:wrap;gap:16px;align-items:center}.prices-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}.prices-stats article{background:#162032;border:1px solid #29405a;padding:16px;border-radius:12px}.prices-stats strong{display:block;font-size:24px;color:#6ee7b7;margin-top:8px}.prices label{display:block;font-weight:700}.prices-controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:18px 0}.prices input,.prices select{display:block;width:100%;padding:11px;border-radius:8px;border:1px solid #486078;background:#0f172a;color:white;font:15px system-ui;margin-top:6px;box-sizing:border-box}.prices button{border:0;border-radius:8px;padding:11px 16px;background:#9d2235;color:white;font-weight:700;cursor:pointer}.prices button:disabled{opacity:.5;cursor:wait}.prices .secondary{background:#334155}.prices-table{overflow-x:auto;border:1px solid #29405a;border-radius:12px;margin:16px 0;background:#111827}.prices table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.prices th{background:#1e2d42;color:#cbd5e1;white-space:nowrap}.prices th,.prices td{padding:12px;border-bottom:1px solid #29405a;vertical-align:top}.prices td:first-child{min-width:200px}.prices tbody tr:nth-child(even){background:#162032}.prices .amount{white-space:nowrap;font-weight:800;color:#6ee7b7}.prices .muted{color:#94a3b8}.prices .zero{color:#fcd34d}.prices .small{font-size:12px}.prices input:focus-visible,.prices select:focus-visible,.prices button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
    @media(max-width:650px){.prices-controls{grid-template-columns:1fr}.prices-stats{grid-template-columns:1fr 1fr}}
    @media print{body>*{visibility:hidden}.prices,.prices *{visibility:visible}.prices{position:absolute;inset:0;background:white!important;color:black;padding:0;font-size:11px}.prices .no-print{display:none!important}.prices-table{overflow:visible;border:0}.prices table{font-size:9px}.prices th,.prices td{padding:5px;color:black!important;background:white!important}.prices td:first-child{min-width:0}.prices p,.prices .amount,.prices .muted,.prices .zero{color:black!important}.prices-stats article{background:white;border:1px solid #bbb}.prices-stats strong{color:black}.prices tr{break-inside:avoid}}
  `}</style><div className="prices-inner">
    <nav className="prices-nav no-print"><Link href="/">← Dashboard</Link><Link href="/cost-savings">Cost Savings</Link><Link href="/price-editor">Edit prices in Pricing Center</Link></nav>
    <h1>Current Prices</h1><p>View the prices currently saved in your inventory. A $0 entry is shown separately from a missing price.</p>
    <div className="prices-stats"><article>Prices above $0<strong>{loading?"—":positive}</strong></article><article>Prices entered as $0<strong>{loading?"—":zero}</strong></article><article>Missing prices<strong>{loading?"—":missing}</strong></article><article>Displayed price total<strong>{loading?"—":money(total)}</strong></article></div>
    <p className="small">The total adds each displayed item's listed price once. It does not multiply by stock quantities. Price per unit is calculated only when units per package are recorded.</p>
    <div className="prices-controls no-print"><label>Search items<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Item, reference, vendor, or category"/></label><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ENTERED">All entered prices (including $0)</option><option value="POSITIVE">Prices above $0</option><option value="ZERO">Prices entered as $0</option><option value="MISSING">Missing prices</option><option value="ALL">All inventory items</option></select></label><label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="NAME">Item name A–Z</option><option value="HIGH">Highest price first</option><option value="LOW">Lowest price first</option></select></label></div>
    <div className="prices-actions no-print"><button disabled={loading} onClick={()=>void load()}>Refresh prices</button><button className="secondary" disabled={loading||!!error} onClick={exportCSV}>Export table CSV</button><button className="secondary" disabled={loading||!!error} onClick={()=>window.print()}>Print / Save PDF</button></div>
    {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
    <p className="small">{loading?"Loading current prices…":`Showing ${visible.length} of ${items.length} items · Loaded ${loadedAt} Central`}{search&&` · Search: ${search}`}</p>
    {!loading&&<div className="prices-table"><table><caption style={{textAlign:"left",padding:12}}>Current inventory prices — {filter==="ENTERED"?"all entered prices":filter==="POSITIVE"?"prices above $0":filter==="ZERO"?"$0 entries":filter==="MISSING"?"missing prices":"all items"}</caption><thead><tr><th scope="col">Item</th><th scope="col">Reference</th><th scope="col">Vendor / category</th><th scope="col">Inventory unit</th><th scope="col">Saved price</th><th scope="col">Units / package</th><th scope="col">Price / unit</th><th scope="col">Source / updated</th></tr></thead><tbody>{visible.map(i=><tr key={i.id}><td><strong>{i.name}</strong></td><td>{i.reference_number||"—"}</td><td>{i.vendor||"—"}<br/><span className="muted">{i.category||"—"}</span></td><td>{i.unit||"—"}</td><td className={i.price===null?"muted":Number(i.price)===0?"amount zero":"amount"}>{i.price===null?"Not entered":money(Number(i.price))}</td><td>{Number(i.units_per_box)>0?i.units_per_box:<span className="muted">Not entered</span>}</td><td>{i.price!==null&&Number(i.units_per_box)>0?money(Number(i.price)/Number(i.units_per_box)):<span className="muted">—</span>}</td><td>{i.price_source||"—"}<br/><span className="muted">{date(i.price_updated_at)}</span></td></tr>)}{visible.length===0&&<tr><td colSpan={8}>No items match this selection.</td></tr>}</tbody></table></div>}
  </div></main>;
}
