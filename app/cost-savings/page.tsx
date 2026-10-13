"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PurchasingSavings from "@/components/PurchasingSavings";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const categories = ["Duplicate order avoided", "Return credit", "Lower purchase price", "Transfer instead of purchase", "Waste prevented", "Other"];
const money = (n: number) => n.toLocaleString("en-US", {style:"currency",currency:"USD"});
const today = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
type Entry = {id:string;created_by:string;event_date:string;item_name:string;category:string;kind:string;quantity:number;unit_label:string;baseline_cost:number;actual_cost:number;amount:number;action_taken:string;evidence:string;credited_to:string;confirmed:boolean;voided:boolean};
type Item = {id:string;name:string;reference_number:string|null};
const initial = () => ({event_date:today(),item_id:"",item_name:"",category:categories[0],kind:"Avoided cost",quantity:"1",unit_label:"package",baseline_cost:"",actual_cost:"0",action_taken:"",evidence:"",credited_to:"Jeremy Johnson",confirmed:false});

export default function CostSavings() {
  const [entries,setEntries]=useState<Entry[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [itemSearch,setItemSearch]=useState("");
  const [form,setForm]=useState(initial);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [month,setMonth]=useState(today().slice(0,7));
  const [person,setPerson]=useState("ALL");
  const [userId,setUserId]=useState("");

  useEffect(()=>{
    let live=true;
    async function load() {
      try {
        const {data:auth,error:authError}=await db.auth.getUser();
        if(authError || !auth.user) throw new Error("Please sign in to view Cost Savings.");
        if(live)setUserId(auth.user.id);
        const rows:Entry[]=[];
        for(let offset=0;;offset+=500){
          const {data,error:queryError}=await db.from("cost_savings").select("*").order("event_date",{ascending:false}).order("id").range(offset,offset+499);
          if(queryError)throw queryError;
          rows.push(...data as Entry[]);
          if(data.length<500)break;
        }
        if(live)setEntries(rows);
      }catch(e){if(live)setError(e instanceof Error?e.message:"Could not load savings.");}
      finally{if(live)setLoading(false);}
    }
    void load();
    return()=>{live=false;};
  },[]);

  useEffect(()=>{
    if(itemSearch.trim().length<2){setItems([]);return;}
    let live=true;
    const timer=setTimeout(async()=>{
      const q=itemSearch.trim().replace(/[%_,()]/g," ").slice(0,100);
      const {data,error:searchError}=await db.from("items").select("id,name,reference_number").or("name.ilike.%"+q+"%,reference_number.ilike.%"+q+"%").order("name").limit(30);
      if(live){setItems(data||[]);if(searchError)setError("Inventory search failed: "+searchError.message);}
    },250);
    return()=>{live=false;clearTimeout(timer);};
  },[itemSearch]);

  const visible=entries.filter(e=>!e.voided && (!month || e.event_date.startsWith(month)) && (person==="ALL" || e.credited_to===person));
  const total=(kind:string,confirmed=true)=>visible.filter(e=>e.kind===kind && e.confirmed===confirmed).reduce((sum,e)=>sum+Number(e.amount),0);
  const estimate=visible.filter(e=>!e.confirmed).reduce((sum,e)=>sum+Number(e.amount),0);
  const calculated=Math.round(Number(form.quantity)*(Number(form.baseline_cost)-Number(form.actual_cost))*100)/100;
  const people=Array.from(new Set(entries.filter(e=>!e.voided).map(e=>e.credited_to))).sort();
  function update(key: keyof ReturnType<typeof initial>,value:string|boolean){setForm(f=>({...f,[key]:value}));}

  async function save(event:FormEvent){
    event.preventDefault();
    if(saving)return;
    if(!Number.isFinite(calculated)||calculated<=0)return setError("The baseline cost must be greater than the actual cost.");
    if(!userId)return setError("Please sign in again.");
    setSaving(true);setError("");setNotice("");
    try{
      const {data,error:saveError}=await db.from("cost_savings").insert({
        ...form, item_id:form.item_id||null, created_by:userId,
        item_name:form.item_name.trim(),action_taken:form.action_taken.trim(),evidence:form.evidence.trim(),credited_to:form.credited_to.trim(),unit_label:form.unit_label.trim(),
        quantity:Number(form.quantity),baseline_cost:Number(form.baseline_cost),actual_cost:Number(form.actual_cost)
      }).select("*").single();
      if(saveError)throw saveError;
      setEntries(old=>[data as Entry,...old]);setForm(initial());setItemSearch("");setMonth(form.event_date.slice(0,7));
      setNotice("Saved. This entry is now included in the selected month's report.");
    }catch(e){setError(e instanceof Error?e.message:"Could not save entry.");}
    finally{setSaving(false);}
  }
  async function voidEntry(entry:Entry){
    if(!confirm("Exclude this entry from totals? The original record will remain saved."))return;
    setError("");
    const {error:saveError}=await db.from("cost_savings").update({voided:true}).eq("id",entry.id).select("id").single();
    if(saveError)setError(saveError.message);
    else setEntries(old=>old.map(e=>e.id===entry.id?{...e,voided:true}:e));
  }
  async function confirmEntry(entry:Entry){
    if(!confirm("Have you checked this amount against the supporting evidence? It will be included in confirmed totals."))return;
    const {error:saveError}=await db.from("cost_savings").update({confirmed:true}).eq("id",entry.id).select("id").single();
    if(saveError)setError(saveError.message);
    else setEntries(old=>old.map(e=>e.id===entry.id?{...e,confirmed:true}:e));
  }
  function exportCSV(){
    const cells=(values:unknown[])=>values.map(v=>{
      let text=String(v??"");
      if(/^[=+\-@\t\r]/.test(text))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    }).join(",");
    const lines=[
      cells(["Baxter ASC Cost Savings",month||"All dates",person]),
      cells(["Confirmed actual savings",total("Actual savings")]),
      cells(["Confirmed avoided costs",total("Avoided cost")]),
      cells(["Unconfirmed estimates (excluded from confirmed totals)",estimate]),
      cells(["Date","Item","Category","Type","Quantity","Unit","Baseline cost per unit","Actual cost per unit","Value","Evidence status","Staff credited","Action","Evidence"]),
      ...visible.map(e=>cells([e.event_date,e.item_name,e.category,e.kind,e.quantity,e.unit_label,e.baseline_cost,e.actual_cost,e.amount,e.confirmed?"Confirmed by recorder":"Unconfirmed estimate",e.credited_to,e.action_taken,e.evidence]))
    ];
    const url=URL.createObjectURL(new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="ASC-Savings-"+(month||"all-dates")+".csv";a.click();URL.revokeObjectURL(url);
  }

  return <main className="savings">
    <style>{`
      .savings{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:24px 16px 90px;font:16px system-ui;}
      .savings-inner{max-width:1000px;margin:auto}.savings a{color:#93c5fd}.savings h1{font-size:28px;margin:16px 0 8px}.savings h2{font-size:20px;margin:0 0 16px}
      .savings p{color:#cbd5e1;line-height:1.5}.savings section,.savings article{background:#162032;border:1px solid #29405a;border-radius:14px;padding:18px;margin:16px 0}
      .savings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.savings label{display:block;font-size:14px;font-weight:700}.savings input,.savings select,.savings textarea{display:block;width:100%;border:1px solid #486078;border-radius:8px;background:#0f172a;color:#fff;padding:11px;font:16px system-ui;margin:6px 0 12px;box-sizing:border-box}
      .savings button{background:#9d2235;color:#fff;border:0;border-radius:8px;padding:12px 16px;font:700 14px system-ui;cursor:pointer}.savings button:disabled{opacity:.5;cursor:wait}.savings .secondary{background:#334155}.savings .summary strong{font-size:28px;display:block;margin-top:8px;color:#6ee7b7}.savings .small{font-size:14px;color:#94a3b8}.savings .check{display:flex;align-items:center;gap:10px}.savings .check input{width:20px;margin:0}.savings .actions{display:flex;flex-wrap:wrap;gap:10px}.savings .evidence{white-space:pre-wrap;overflow-wrap:anywhere}.savings .result{display:block;width:100%;text-align:left;margin-bottom:6px;background:#334155}
      @media print{body>*{visibility:hidden}.savings,.savings *{visibility:visible}.savings{position:absolute;inset:0;background:white!important;color:black!important;padding:0;font-size:12px}.savings .no-print{display:none!important}.savings section,.savings article{background:white;border:1px solid #bbb;break-inside:avoid}.savings p,.savings .small,.savings .summary strong{color:black!important}.savings h1{font-size:24px}}
    `}</style>
    <div className="savings-inner">
      <Link className="no-print" href="/">← Dashboard</Link>
      <h1>Cost Savings</h1>
      <Link className="no-print" href="/current-prices">View current inventory prices →</Link>
      <p>Document the value of your inventory work at Baxter ASC.</p>
      <PurchasingSavings />
      <h2 style={{marginTop:32}}>Other savings: credits, avoided purchases & waste</h2>
      <div className="savings-grid no-print">
        <label>Report month<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
        <label>Staff credited<select value={person} onChange={e=>setPerson(e.target.value)}><option value="ALL">All staff</option>{people.map(p=><option key={p}>{p}</option>)}</select></label>
      </div>
      <p>Report: {month||"All dates"} · {person==="ALL"?"All staff":person}</p>
      <div className="savings-grid summary">
        <section>Confirmed actual savings<strong>{money(total("Actual savings"))}</strong><span className="small">Credits received or documented reductions in purchase cost.</span></section>
        <section>Confirmed avoided costs<strong>{money(total("Avoided cost"))}</strong><span className="small">Purchases or replacement expenses prevented.</span></section>
        <section>Unconfirmed estimates<strong style={{color:"#fcd34d"}}>{money(estimate)}</strong><span className="small">Excluded from both confirmed totals.</span></section>
      </div>
      <p className="small">Confirmation is recorded by the person entering the evidence; it is not a finance department approval. Count each saving once. A transfer only counts when it prevented an ASC purchase; a delivery pickup by itself does not.</p>
      <div className="actions no-print"><button onClick={()=>window.print()} disabled={loading}>Print / Save PDF</button><button className="secondary" onClick={exportCSV} disabled={loading}>Export report CSV</button></div>
      {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}{notice&&<p role="status" style={{color:"#6ee7b7"}}>{notice}</p>}
      <section className="no-print">
        <h2>Record a saving</h2>
        <form onSubmit={save}>
          <label>Find inventory item<input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Search any inventory item or reference number"/></label>
          {items.map(i=><button type="button" className="result" key={i.id} onClick={()=>{setForm(f=>({...f,item_id:i.id,item_name:i.name}));setItemSearch("");}}>{i.name} {i.reference_number?" · "+i.reference_number:""}</button>)}
          <div className="savings-grid">
            <label>Item or saving description<input required maxLength={300} value={form.item_name} onChange={e=>{update("item_name",e.target.value);update("item_id","");}}/></label>
            <label>Date<input required type="date" value={form.event_date} onChange={e=>update("event_date",e.target.value)}/></label>
            <label>Category<select value={form.category} onChange={e=>{const category=e.target.value;setForm(f=>({...f,category,kind:["Return credit","Lower purchase price"].includes(category)?"Actual savings":"Avoided cost"}));}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Type<select value={form.kind} onChange={e=>update("kind",e.target.value)}><option>Actual savings</option><option>Avoided cost</option></select></label>
            <label>Quantity<input required type="number" min=".001" max="1000000" step=".001" value={form.quantity} onChange={e=>update("quantity",e.target.value)}/></label>
            <label>Unit (use the same basis for both prices)<input required maxLength={80} value={form.unit_label} onChange={e=>update("unit_label",e.target.value)} placeholder="Box, package, each, or credit"/></label>
            <label>Baseline cost per unit ($)<input required type="number" min="0" max="9999999999" step=".01" value={form.baseline_cost} onChange={e=>update("baseline_cost",e.target.value)}/></label>
            <label>Actual cost per unit ($)<input required type="number" min="0" max="9999999999" step=".01" value={form.actual_cost} onChange={e=>update("actual_cost",e.target.value)}/></label>
          </div>
          <p>Value: <strong>{Number.isFinite(calculated)?money(calculated):"—"}</strong> · Quantity × (baseline − actual cost)</p>
          <p className="small">For a return credit, enter quantity 1, unit “credit,” the credit amount as baseline, and 0 actual cost. Include any added transfer or handling cost in actual cost.</p>
          <label>What did you do?<textarea required maxLength={2000} rows={3} value={form.action_taken} onChange={e=>update("action_taken",e.target.value)}/></label>
          <label>Supporting evidence / reference<textarea required maxLength={2000} rows={3} value={form.evidence} onChange={e=>update("evidence",e.target.value)} placeholder="Invoice or credit number, canceled order reference, price comparison, date, or explanation of the estimate."/></label>
          <label>Staff credited<input required maxLength={200} value={form.credited_to} onChange={e=>update("credited_to",e.target.value)}/></label>
          <label className="check"><input type="checkbox" checked={form.confirmed} onChange={e=>update("confirmed",e.target.checked)}/>I have confirmed this value against the supporting evidence.</label>
          <p className="small">Leave unchecked when the value is still an estimate.</p>
          <button disabled={saving||loading} type="submit">{saving?"Saving…":"Save Saving"}</button>
        </form>
      </section>
      <h2 style={{marginTop:24}}>Supporting records ({visible.length})</h2>
      {loading?<p>Loading savings…</p>:visible.length===0?<p>No savings recorded for this selection yet.</p>:visible.map(e=><article key={e.id}>
        <div className="savings-grid"><div><strong>{e.item_name}</strong><p className="small">{e.event_date} · {e.credited_to}<br/>{e.category} · {e.kind}<br/>{e.confirmed?"Confirmed by recorder":"Unconfirmed estimate"}</p></div><div><strong style={{fontSize:24}}>{money(Number(e.amount))}</strong><p className="small">{e.quantity} {e.unit_label} × ({money(Number(e.baseline_cost))} − {money(Number(e.actual_cost))})</p></div></div>
        <p className="evidence"><strong>Action:</strong> {e.action_taken}</p><p className="evidence"><strong>Evidence:</strong> {e.evidence}</p>
        {e.created_by===userId&&<div className="actions no-print">{!e.confirmed&&<button onClick={()=>confirmEntry(e)}>Confirm evidence and value</button>}<button className="secondary" onClick={()=>voidEntry(e)}>Exclude incorrect / duplicate entry</button></div>}
      </article>)}
    </div>
  </main>;
}
