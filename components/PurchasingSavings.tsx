"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const money=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD"});
const unitMoney=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4});
type Improvement={id:string;created_by:string;effective_date:string;old_product:string;new_product:string;old_vendor:string;new_vendor:string;old_package_price:number;new_package_price:number;old_package_units:number;new_package_units:number;unit_label:string;monthly_packages:number;credited_to:string;evidence:string;active:boolean};
type Purchase={id:string;created_by:string;improvement_id:string;purchase_date:string;invoice_reference:string;packages:number;paid_package_price:number;previous_spend:number;current_spend:number;savings:number;confirmed:boolean;voided:boolean};
const initial=()=>({effective_date:today(),old_product:"",new_product:"",old_vendor:"",new_vendor:"",old_package_price:"",new_package_price:"",old_package_units:"1",new_package_units:"1",unit_label:"each",monthly_packages:"",credited_to:"Jeremy Johnson",evidence:""});
const initialPurchase=()=>({improvement_id:"",purchase_date:today(),invoice_reference:"",packages:"",paid_package_price:"",confirmed:false});
const perPackage=(i:Improvement)=>Number(i.new_package_units)*Number(i.old_package_price)/Number(i.old_package_units)-Number(i.new_package_price);

export default function PurchasingSavings(){
  const [improvements,setImprovements]=useState<Improvement[]>([]);
  const [purchases,setPurchases]=useState<Purchase[]>([]);
  const [form,setForm]=useState(initial);
  const [purchase,setPurchase]=useState(initialPurchase);
  const [userId,setUserId]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [month,setMonth]=useState(today().slice(0,7));
  const [person,setPerson]=useState("ALL");
  useEffect(()=>{
    const saved=sessionStorage.getItem("asc-purchasing-draft");
    if(!saved)return;
    try{
      const draft=JSON.parse(saved) as Record<string,unknown>;
      const clean:Partial<ReturnType<typeof initial>>={};
      for(const key of ["old_product","new_product","old_vendor","new_vendor","old_package_price","new_package_price","old_package_units","new_package_units","unit_label","monthly_packages","evidence"] as const){
        if(typeof draft[key]==="string")clean[key]=draft[key].slice(0,key==="evidence"?2000:300);
      }
      setForm(f=>({...f,...clean}));setNotice("Vendor comparison loaded as a draft. Review the price, package sizes and evidence before saving.");
      sessionStorage.removeItem("asc-purchasing-draft");
    }catch{sessionStorage.removeItem("asc-purchasing-draft");}
  },[]);
  useEffect(()=>{
    let live=true;
    async function loadRows<T>(table:string):Promise<T[]>{
      const rows:T[]=[];
      for(let offset=0;;offset+=500){
        const {data,error:queryError}=await db.from(table).select("*").order("id").range(offset,offset+499);
        if(queryError)throw queryError;
        rows.push(...data as T[]);if(data.length<500)return rows;
      }
    }
    void(async()=>{
      try{
        const {data:auth,error:authError}=await db.auth.getUser();
        if(authError||!auth.user)throw new Error("Please sign in to track purchasing savings.");
        const [changes,records]=await Promise.all([loadRows<Improvement>("purchasing_improvements"),loadRows<Purchase>("purchasing_savings_purchases")]);
        if(live){setUserId(auth.user.id);setImprovements(changes);setPurchases(records);}
      }catch(e){if(live)setError(e instanceof Error?e.message:"Could not load purchasing savings.");}
      finally{if(live)setLoading(false);}
    })();return()=>{live=false;};
  },[]);
  const people=Array.from(new Set(improvements.map(i=>i.credited_to))).sort();
  const changes=improvements.filter(i=>person==="ALL"||i.credited_to===person).sort((a,b)=>b.effective_date.localeCompare(a.effective_date));
  const matchingIds=new Set(changes.map(i=>i.id));
  const records=purchases.filter(p=>!p.voided&&matchingIds.has(p.improvement_id)&&(!month||p.purchase_date.startsWith(month))).sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date));
  const confirmed=records.filter(p=>p.confirmed);
  const monthlyHistory=Array.from(new Set(purchases.filter(p=>!p.voided&&p.confirmed&&matchingIds.has(p.improvement_id)).map(p=>p.purchase_date.slice(0,7)))).sort().reverse().map(period=>{
    const rows=purchases.filter(p=>!p.voided&&p.confirmed&&matchingIds.has(p.improvement_id)&&p.purchase_date.startsWith(period));
    return {period,previous:rows.reduce((s,p)=>s+Number(p.previous_spend),0),current:rows.reduce((s,p)=>s+Number(p.current_spend),0),savings:rows.reduce((s,p)=>s+Number(p.savings),0)};
  });
  const sum=(key:"previous_spend"|"current_spend"|"savings")=>confirmed.reduce((s,p)=>s+Number(p[key]),0);
  const monthlyProjection=changes.filter(i=>i.active&&i.effective_date<=today()).reduce((s,i)=>s+perPackage(i)*Number(i.monthly_packages),0);
  const chosen=improvements.find(i=>i.id===purchase.improvement_id);
  const oldUnit=Number(form.old_package_price)/Number(form.old_package_units);
  const newUnit=Number(form.new_package_price)/Number(form.new_package_units);
  const projected=Number(form.monthly_packages)*Number(form.new_package_units)*(oldUnit-newUnit);
  const expectedOld=chosen?Math.round(Number(purchase.packages)*Number(chosen.new_package_units)*Number(chosen.old_package_price)/Number(chosen.old_package_units)*100)/100:0;
  const expectedNew=Math.round(Number(purchase.packages)*Number(purchase.paid_package_price)*100)/100;
  function update(key:keyof ReturnType<typeof initial>,value:string){setForm(f=>({...f,[key]:value}));}
  async function saveImprovement(event:FormEvent){
    event.preventDefault();if(saving)return;
    if(!userId)return setError("Please sign in again.");
    if(!Number.isFinite(oldUnit)||!Number.isFinite(newUnit)||newUnit>=oldUnit)return setError("The new price per comparable unit must be lower than the old price.");
    setSaving(true);setError("");setNotice("");
    try{
      const {data,error:saveError}=await db.from("purchasing_improvements").insert({
        ...form,created_by:userId,old_product:form.old_product.trim(),new_product:form.new_product.trim(),credited_to:form.credited_to.trim(),evidence:form.evidence.trim(),unit_label:form.unit_label.trim(),
        old_package_price:Number(form.old_package_price),new_package_price:Number(form.new_package_price),old_package_units:Number(form.old_package_units),new_package_units:Number(form.new_package_units),monthly_packages:Number(form.monthly_packages)
      }).select("*").single();
      if(saveError)throw saveError;
      setImprovements(old=>[data as Improvement,...old]);setPurchase(p=>({...p,improvement_id:data.id,paid_package_price:String(data.new_package_price)}));setForm(initial());
      setNotice("Price improvement saved. Record purchases below to build the actual savings total.");
    }catch(e){setError(e instanceof Error?e.message:"Could not save improvement.");}finally{setSaving(false);}
  }
  async function savePurchase(event:FormEvent){
    event.preventDefault();if(saving||!chosen)return;
    if(!userId)return setError("Please sign in again.");
    if(purchase.purchase_date<chosen.effective_date)return setError("Purchase date must be on or after the improvement date.");
    setSaving(true);setError("");setNotice("");
    try{
      const {data,error:saveError}=await db.from("purchasing_savings_purchases").insert({
        ...purchase,created_by:userId,invoice_reference:purchase.invoice_reference.trim(),packages:Number(purchase.packages),paid_package_price:Number(purchase.paid_package_price),
        old_package_price:chosen.old_package_price,old_package_units:chosen.old_package_units,new_package_units:chosen.new_package_units
      }).select("*").single();
      if(saveError){if(saveError.code==="23505")throw new Error("That invoice / line reference has already been recorded for this improvement. Use a unique reference for each purchase.");throw saveError;}
      setPurchases(old=>[data as Purchase,...old]);setMonth(purchase.purchase_date.slice(0,7));setPurchase(initialPurchase());
      setNotice("Purchase saved. Verified purchases are included in the financial report.");
    }catch(e){setError(e instanceof Error?e.message:"Could not record purchase.");}finally{setSaving(false);}
  }
  async function changePurchase(p:Purchase,field:"confirmed"|"voided"){
    if(!confirm(field==="confirmed"?"Have you verified this purchase quantity and price against the invoice?":"Exclude this purchase from totals? Its record will remain saved."))return;
    const {error:saveError}=await db.from("purchasing_savings_purchases").update({[field]:true}).eq("id",p.id).select("id").single();
    if(saveError)setError(saveError.message);else setPurchases(old=>old.map(row=>row.id===p.id?{...row,[field]:true}:row));
  }
  async function toggleActive(i:Improvement){
    const {error:saveError}=await db.from("purchasing_improvements").update({active:!i.active}).eq("id",i.id).select("id").single();
    if(saveError)setError(saveError.message);else setImprovements(old=>old.map(row=>row.id===i.id?{...row,active:!row.active}:row));
  }
  function exportReport(){
    const line=(values:unknown[])=>values.map(v=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",");
    const rows=[line(["Baxter ASC Purchasing Improvements",month||"All dates",person]),line(["Previous cost for comparable purchased quantities",sum("previous_spend")]),line(["Actual purchase spending",sum("current_spend")]),line(["Verified purchase savings",sum("savings")]),line(["Estimated monthly savings (active improvements)",monthlyProjection]),line(["Estimated annual savings (active improvements)",monthlyProjection*12]),
      line(["Price improvements — projections, not actual savings"]),line(["Effective date","Old product","Old vendor","Old package price","Old package units","New product","New vendor","New package price","New package units","Comparable unit","Expected new packages/month","Estimated annual savings","Staff credited","Evidence","Projection active"]),
      ...changes.map(i=>line([i.effective_date,i.old_product,i.old_vendor,i.old_package_price,i.old_package_units,i.new_product,i.new_vendor,i.new_package_price,i.new_package_units,i.unit_label,i.monthly_packages,perPackage(i)*Number(i.monthly_packages)*12,i.credited_to,i.evidence,i.active])),
      line(["Monthly history — all recorded months for selected staff"]),line(["Month","Previous comparable cost","Actual spend","Verified savings"]),...monthlyHistory.map(m=>line([m.period,m.previous,m.current,m.savings])),
      line(["Recorded purchases"]),line(["Purchase date","Old product","New product","Packages purchased","Paid price/package","Previous comparable cost","Actual spend","Savings","Invoice / line reference","Verified by recorder","Staff credited"]),
      ...records.map(p=>{const i=improvements.find(i=>i.id===p.improvement_id)!;return line([p.purchase_date,i.old_product,i.new_product,p.packages,p.paid_package_price,p.previous_spend,p.current_spend,p.savings,p.invoice_reference,p.confirmed,i.credited_to]);})];
    const url=URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="ASC-Purchasing-Savings-"+(month||"all-dates")+".csv";a.click();URL.revokeObjectURL(url);
  }
  return <div className="purchasing-report">
    <h2>Purchasing improvements & financial impact</h2>
    <p>Save a lower price or product replacement, then record each purchase to show how much the ASC saved. Enter prices including freight or other purchasing costs on the same basis.</p>
    <div className="savings-grid no-print"><label>Purchase report month<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Improvement made by<select value={person} onChange={e=>setPerson(e.target.value)}><option value="ALL">All staff</option>{people.map(p=><option key={p}>{p}</option>)}</select></label></div>
    <p><strong>Savings from purchasing improvements made by {person==="ALL"?"ASC staff":person}</strong><br/>Purchase period: {month||"All dates"}</p>
    <div className="savings-grid summary"><section>Previous comparable cost<strong>{money(sum("previous_spend"))}</strong><span className="small">What the recorded quantities would have cost at the old price.</span></section><section>Actual spending<strong>{money(sum("current_spend"))}</strong><span className="small">Cost of verified purchases recorded for this period.</span></section><section>Verified purchase savings<strong>{money(sum("savings"))}</strong><span className="small">Previous comparable cost minus actual spending.</span></section></div>
    <div className="savings-grid summary"><section>Estimated monthly savings<strong>{money(monthlyProjection)}</strong><span className="small">Based on expected volume for currently active improvements.</span></section><section>Estimated yearly savings<strong>{money(monthlyProjection*12)}</strong><span className="small">12 months at expected volume and saved comparison prices. Separate from actual savings.</span></section></div>
    <p className="small">Unverified purchases: {records.filter(p=>!p.confirmed).length} (excluded from actual totals). Previous cost is a comparison for the same quantity, not a reconstruction of past invoices. Verification is by the recorder, not finance approval. Include each invoice line once; do not also enter it in Other Savings below.</p>
    <div className="actions no-print"><button disabled={loading} onClick={()=>window.print()}>Print financial report / Save PDF</button><button className="secondary" disabled={loading} onClick={exportReport}>Export financial report CSV</button></div>
    {monthlyHistory.length>0&&<section><h2>Monthly savings history</h2><p className="small">All recorded months for the selected staff member. Verified purchases only.</p><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}><thead><tr><th scope="col">Month</th><th scope="col">Previous comparable cost</th><th scope="col">Actual spending</th><th scope="col">Savings</th></tr></thead><tbody>{monthlyHistory.map(m=><tr key={m.period}><td style={{padding:"10px 4px"}}>{m.period}</td><td>{money(m.previous)}</td><td>{money(m.current)}</td><td>{money(m.savings)}</td></tr>)}</tbody></table></div></section>}
    {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}{notice&&<p role="status" style={{color:"#6ee7b7"}}>{notice}</p>}
    <section className="no-print"><h2>1. Save a price improvement</h2><form onSubmit={saveImprovement}><div className="savings-grid">
      <label>Old product / reference<input required maxLength={300} value={form.old_product} onChange={e=>update("old_product",e.target.value)}/></label><label>New product / reference<input required maxLength={300} value={form.new_product} onChange={e=>update("new_product",e.target.value)} placeholder="Same product for a negotiated lower price"/></label>
      <label>Old vendor<input maxLength={300} value={form.old_vendor} onChange={e=>update("old_vendor",e.target.value)}/></label><label>New vendor<input maxLength={300} value={form.new_vendor} onChange={e=>update("new_vendor",e.target.value)}/></label>
      <label>Old price per package ($)<input required type="number" min=".01" max="9999999999" step=".01" value={form.old_package_price} onChange={e=>update("old_package_price",e.target.value)}/></label><label>New price per package ($)<input required type="number" min="0" max="9999999999" step=".01" value={form.new_package_price} onChange={e=>update("new_package_price",e.target.value)}/></label>
      <label>Comparable units in old package<input required type="number" min=".001" max="1000000" step=".001" value={form.old_package_units} onChange={e=>update("old_package_units",e.target.value)}/></label><label>Comparable units in new package<input required type="number" min=".001" max="1000000" step=".001" value={form.new_package_units} onChange={e=>update("new_package_units",e.target.value)}/></label>
      <label>Comparable unit<input required maxLength={80} value={form.unit_label} onChange={e=>update("unit_label",e.target.value)} placeholder="Each, mL, pair — same basis for both"/></label><label>Expected NEW packages per month<input required type="number" min="0" max="1000000" step=".001" value={form.monthly_packages} onChange={e=>update("monthly_packages",e.target.value)}/></label>
      <label>Improvement date<input required type="date" value={form.effective_date} onChange={e=>update("effective_date",e.target.value)}/></label><label>Improvement made by<input required maxLength={200} value={form.credited_to} onChange={e=>update("credited_to",e.target.value)}/></label>
    </div><p className="small">Compare equivalent usable products. Example: old box of 10 versus new box of 20 → enter 10 and 20, with “each” as the comparable unit. Enter 0 expected packages if volume is unknown.</p>
    {form.old_package_price&&form.new_package_price&&Number.isFinite(projected)&&<p>Old: {unitMoney(oldUnit)} / {form.unit_label} · New: {unitMoney(newUnit)} / {form.unit_label}<br/>Estimated monthly savings: {money(projected)} · Estimated yearly: {money(projected*12)}</p>}
    <label>What changed and supporting price evidence<textarea required rows={3} maxLength={2000} value={form.evidence} onChange={e=>update("evidence",e.target.value)} placeholder="Old invoice and new quote/reference, why products are comparable, and source of expected monthly volume."/></label><p className="small">If price or expected volume changes again, stop the old projection and save a new comparison. Past purchases remain in the report.</p><button disabled={saving||loading}>{saving?"Saving…":"Save Price Improvement"}</button></form></section>
    <section className="no-print"><h2>2. Record a purchase at the new price</h2><form onSubmit={savePurchase}><label>Price improvement<select required value={purchase.improvement_id} onChange={e=>{const i=improvements.find(i=>i.id===e.target.value);setPurchase(p=>({...p,improvement_id:e.target.value,paid_package_price:i?String(i.new_package_price):""}));}}><option value="">Choose a saved improvement</option>{improvements.map(i=><option key={i.id} value={i.id}>{i.new_product} · {i.effective_date}{!i.active?" (projection stopped)":""}</option>)}</select></label><div className="savings-grid">
      <label>Purchase date<input required type="date" min={chosen?.effective_date} value={purchase.purchase_date} onChange={e=>setPurchase(p=>({...p,purchase_date:e.target.value}))}/></label><label>NEW packages actually purchased<input required type="number" min=".001" max="1000000" step=".001" value={purchase.packages} onChange={e=>setPurchase(p=>({...p,packages:e.target.value}))}/></label>
      <label>Actual price paid per NEW package ($)<input required type="number" min="0" max="9999999999" step=".01" value={purchase.paid_package_price} onChange={e=>setPurchase(p=>({...p,paid_package_price:e.target.value}))}/></label><label>Unique invoice / line reference<input required maxLength={300} value={purchase.invoice_reference} onChange={e=>setPurchase(p=>({...p,invoice_reference:e.target.value}))} placeholder="Invoice 123 — line 4"/></label>
    </div>{chosen&&<p>Previous comparable cost: {money(expectedOld)} · Actual cost: {money(expectedNew)}<br/>Purchase savings: <strong>{money(expectedOld-expectedNew)}</strong></p>}
    <label className="check"><input type="checkbox" checked={purchase.confirmed} onChange={e=>setPurchase(p=>({...p,confirmed:e.target.checked}))}/>I verified this quantity and price against the purchase evidence.</label><p className="small">Record actual purchases here as they happen. Totals grow from these records. If the actual price rises above the old price, the negative saving reduces the total.</p><button disabled={saving||loading||!chosen}>{saving?"Saving…":"Record Purchase"}</button></form></section>
    <h2 style={{marginTop:24}}>Price improvements ({changes.length})</h2>
    {loading?<p>Loading purchasing improvements…</p>:changes.length===0?<p>No price improvements recorded yet.</p>:changes.map(i=><article key={i.id}><h3>{i.old_product} → {i.new_product}</h3><p className="small">{i.effective_date} · Improvement by {i.credited_to} · {i.active?"Projection active":"Projection stopped"}</p><div className="savings-grid"><p>Old: {money(Number(i.old_package_price))} / package of {i.old_package_units} {i.unit_label}<br/>{i.old_vendor||"Vendor not recorded"}<br/>{unitMoney(Number(i.old_package_price)/Number(i.old_package_units))} / {i.unit_label}</p><p>New: {money(Number(i.new_package_price))} / package of {i.new_package_units} {i.unit_label}<br/>{i.new_vendor||"Vendor not recorded"}<br/>{unitMoney(Number(i.new_package_price)/Number(i.new_package_units))} / {i.unit_label}</p></div><p>Saving per NEW package: <strong>{money(perPackage(i))}</strong><br/>Estimated yearly savings: {money(perPackage(i)*Number(i.monthly_packages)*12)} at {i.monthly_packages} new packages/month</p><p className="evidence">Evidence: {i.evidence}</p>{i.created_by===userId&&<button className="secondary no-print" onClick={()=>toggleActive(i)}>{i.active?"Stop future projection":"Resume projection"}</button>}</article>)}
    <h2 style={{marginTop:24}}>Recorded purchases ({records.length})</h2>{records.length===0?<p>No purchases recorded for this period.</p>:records.map(p=><article key={p.id}><strong>{improvements.find(i=>i.id===p.improvement_id)?.new_product}</strong><p className="small">{p.purchase_date} · {p.invoice_reference} · {p.confirmed?"Verified by recorder":"Unverified — excluded from actual totals"}</p><p>{p.packages} new packages at {money(Number(p.paid_package_price))}<br/>Previous comparable cost: {money(Number(p.previous_spend))} · Actual spend: {money(Number(p.current_spend))}<br/>Savings: <strong>{money(Number(p.savings))}</strong></p>{p.created_by===userId&&<div className="actions no-print">{!p.confirmed&&<button onClick={()=>changePurchase(p,"confirmed")}>Verify purchase</button>}<button className="secondary" onClick={()=>changePurchase(p,"voided")}>Exclude incorrect / duplicate purchase</button></div>}</article>)}
  </div>;
}
