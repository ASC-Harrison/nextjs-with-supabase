"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@supabase/supabase-js";
import AccuracyItemEditor from "@/app/components/AccuracyItemEditor";
import {accuracyDraftKey,readAccuracyDrafts,type AccuracyDraft} from "@/lib/accuracy-drafts";
import {matchesAccuracySearch} from "@/lib/accuracy-catalog";

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Area={id:string;name:string;is_main:boolean};
type Verification={actual_on_hand:number;difference:number;verified_by:string;verified_at:string};
type Item={item_id:string;name:string;reference_number:string|null;vendor:string|null;unit:string|null;category:string|null;barcode:string|null;item_number:string|null;shelf:string|null;on_hand:number|null;updated_at:string|null;last_verification:Verification|null;assigned:boolean;is_active:boolean;locations:{area_id:string;area_name:string;active:boolean;on_hand:number|null}[]};
type Filter="ALL"|"ENTERED"|"UNSAVED"|"VERIFIED";
const css=`
body{margin:0;background:#080d19}.acc{font-family:system-ui,sans-serif;color:#f1f5f9;min-height:100vh;padding:18px 14px 110px;background:#080d19}.acc *{box-sizing:border-box}.acc-wrap{max-width:950px;margin:auto}.acc button{cursor:pointer;border:1px solid #345070;border-radius:10px;padding:10px 13px;background:#1b2b43;color:#dbeafe;font:700 12px system-ui}.acc button:disabled{opacity:.5;cursor:wait}.acc button:focus-visible,.acc input:focus-visible,.acc select:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}.acc-hero{background:linear-gradient(135deg,#182c48,#171e30);border:1px solid #304969;border-radius:20px;padding:20px;margin:12px 0}.acc h1{margin:0;font-size:25px}.acc p{font-size:13px;line-height:1.5;color:#a9bad1}.acc-safe{border-left:3px solid #34d399;padding-left:10px}.acc-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.acc input,.acc select{background:#0d1727;border:1px solid #345070;border-radius:10px;color:#f8fafc;font:14px system-ui;padding:12px}.acc-search{flex:1;min-width:180px}.acc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.acc-stat{background:#142137;border:1px solid #293e5a;border-radius:12px;padding:12px;text-align:center}.acc-stat strong{display:block;font-size:24px}.acc-stat span{color:#9bacc4;font-size:11px}.acc-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:10px}.acc-item{border:1px solid #2d4362;border-radius:14px;padding:15px;background:#131f33}.acc-item.pending{border-color:#d9a441}.acc-item.saved{border-color:#237d65}.acc-item.error{border-color:#e06666}.acc-head{display:flex;justify-content:space-between;gap:10px}.acc-name{font-size:14px;font-weight:850}.acc-meta{font-size:11px;color:#9aacc5;margin-top:5px;line-height:1.5}.acc-current{text-align:right;white-space:nowrap}.acc-current strong{display:block;font-size:22px}.acc-current span{color:#9aacc5;font-size:10px}.acc-input{display:block;width:100%;font-size:19px!important;font-weight:800!important;text-align:center;margin:6px 0}.acc-label{font-size:11px;font-weight:750;color:#b4c4d9;display:block;margin-top:12px}.acc-status{font-size:11px;line-height:1.5;margin:8px 0;color:#fcd34d}.acc-status.saved{color:#86efac}.acc-status.error{color:#fca5a5}.acc-message{padding:12px;border:1px solid #385274;border-radius:10px;margin:10px 0;color:#dbeafe;font-size:13px;line-height:1.5}.acc-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.acc-print{display:none}.acc-print table{width:100%;border-collapse:collapse}.acc-print th,.acc-print td{border:1px solid #999;padding:6px;font-size:10px;text-align:left}.acc-print th{background:#eee}.acc-empty{padding:35px;text-align:center;color:#a9bad1}.acc .primary{background:#2563eb}.acc-filter[aria-pressed=true]{background:#23538a;border-color:#60a5fa}
@media print{@page{size:landscape;margin:12mm}body{background:white!important}body *{visibility:hidden!important}.acc-print,.acc-print *{visibility:visible!important}.acc-print{display:block!important;position:absolute;top:0;left:0;width:100%;color:black;background:white;font-family:Arial,sans-serif}.acc-print tr{break-inside:avoid}.acc-print thead{display:table-header-group}.acc-print h1{font-size:20px}.acc-print p{color:black;font-size:11px}.acc-print th,.acc-print td{color:black!important}.acc-wrap>*:not(.acc-print){display:none!important}}
`;

export default function InventoryAccuracyPage(){
  const router=useRouter();
  const [areas,setAreas]=useState<Area[]>([]),[areaId,setAreaId]=useState("");
  const [items,setItems]=useState<Item[]>([]),[drafts,setDrafts]=useState<Record<string,AccuracyDraft>>({});
  const [loading,setLoading]=useState(true),[message,setMessage]=useState("");
  const [search,setSearch]=useState(""),[filter,setFilter]=useState<Filter>("ALL"),[limit,setLimit]=useState(100);
  const [areaOnly,setAreaOnly]=useState(false);
  const [saving,setSaving]=useState<Record<string,boolean>>({}),[editing,setEditing]=useState<Item|null>(null);
  const [bulkSaving,setBulkSaving]=useState(false);
  const [printing,setPrinting]=useState(false);
  const [returnToReorder,setReturnToReorder]=useState(false),[printedAt,setPrintedAt]=useState("");
  const draftRef=useRef<Record<string,AccuracyDraft>>({});
  const context=useRef({userId:"",areaId:""});
  const inFlight=useRef(new Set<string>());
  const loadVersion=useRef(0);
  const authFetch=useCallback(async(url:string,options:RequestInit={})=>{
    const {data}=await db.auth.getSession();if(!data.session)throw new Error("Please sign in again. Your entered counts remain on this device.");
    return fetch(url,{...options,cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`,...options.headers}});
  },[]);
  const persist=useCallback((next:Record<string,AccuracyDraft>)=>{
    draftRef.current=next;setDrafts(next);
    const current=context.current;if(!current.userId||!current.areaId)return;
    try{localStorage.setItem(accuracyDraftKey(current.userId,current.areaId),JSON.stringify(next));}
    catch{setMessage("This device could not retain the entries locally. Keep this screen open and use Save now; only a green Saved status confirms the live count.");}
  },[]);
  const loadArea=useCallback(async(requestedArea?:string)=>{
    if(inFlight.current.size)return;
    const version=++loadVersion.current;setLoading(true);setMessage("");
    try{
      const {data:session}=await db.auth.getSession();if(!session.session)throw new Error("Please sign in to count inventory.");
      const userId=session.session.user.id;
      let nextArea=requestedArea;
      if(!nextArea){try{nextArea=localStorage.getItem(`asc-accuracy-last-area:${userId}`)||undefined;}catch{}}
      const response=await authFetch("/api/inventory-accuracy"+(nextArea?`?area_id=${encodeURIComponent(nextArea)}`:"")),data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Could not load inventory");
      if(version!==loadVersion.current)return;
      const selected=String(data.selected_area_id),rows=(data.items||[]) as Item[];
      let restored:Record<string,AccuracyDraft>={};
      try{restored=readAccuracyDrafts(localStorage.getItem(accuracyDraftKey(userId,selected)));localStorage.setItem(`asc-accuracy-last-area:${userId}`,selected);}catch{}
      for(const row of rows){const entry=restored[row.item_id];if(entry&&entry.unit!==row.unit)restored[row.item_id]={...entry,status:"error",conflict:true,error:"The unit changed since this entry. Physically check and re-enter the count using the displayed unit."};}
      context.current={userId,areaId:selected};draftRef.current=restored;
      setDrafts(restored);setAreas(data.areas||[]);setAreaId(selected);setItems(rows);setLimit(100);
    }catch(error){setMessage(error instanceof Error?error.message:"Could not load inventory");}
    finally{if(version===loadVersion.current)setLoading(false);}
  },[authFetch]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);setSearch(params.get("reference")||"");setReturnToReorder(params.get("from")==="smart-reorder");void loadArea(params.get("area_id")||undefined);},[loadArea]);
  const selectedArea=areas.find(area=>area.id===areaId)?.name||"Storage area";
  const areaItems=useMemo(()=>items.filter(item=>item.assigned),[items]);
  const entered=useMemo(()=>items.filter(item=>item.assigned&&item.is_active&&item.on_hand!==null&&drafts[item.item_id]?.value!==undefined&&drafts[item.item_id].value!==""),[items,drafts]);
  const pending=entered.filter(item=>drafts[item.item_id].status!=="saved");
  const busy=bulkSaving||printing||Object.values(saving).some(Boolean);
  const filtered=useMemo(()=>items.filter(item=>{
    if(search.trim())return matchesAccuracySearch(item,search);
    if(areaOnly&&!item.assigned)return false;
    const entry=drafts[item.item_id];
    if(filter==="ENTERED"&&(!entry||entry.value===""))return false;
    if(filter==="UNSAVED"&&(!entry||entry.value===""||entry.status==="saved"))return false;
    if(filter==="VERIFIED"&&!item.last_verification)return false;
    return true;
  }),[items,drafts,search,filter,areaOnly]);

  function setCount(item:Item,value:string){
    if(inFlight.current.has(item.item_id)||!item.assigned||!item.is_active||item.on_hand===null)return;
    const clean=value.replace(/\D/g,"").slice(0,7),old=draftRef.current[item.item_id];
    const keepBaseline=old&&old.status!=="saved"&&!old.conflict&&old.unit===item.unit;
    persist({...draftRef.current,[item.item_id]:{value:clean,expected:keepBaseline?old.expected:item.on_hand,unit:item.unit,status:"pending"}});
  }
  async function saveCount(item:Item){
    if(!item.assigned||!item.is_active||item.on_hand===null)return;
    const id=item.item_id,entry=draftRef.current[id];
    if(!entry||entry.value===""||entry.status==="saved"||inFlight.current.has(id)||entry.conflict)return;
    if(entry.unit!==item.unit){persist({...draftRef.current,[id]:{...entry,status:"error",conflict:true,error:"The count unit changed. Physically check and re-enter this quantity using the displayed unit."}});return;}
    inFlight.current.add(id);setSaving(old=>({...old,[id]:true}));
    try{
      const response=await authFetch("/api/inventory-accuracy/count",{method:"POST",body:JSON.stringify({area_id:context.current.areaId,item_id:id,expected_on_hand:entry.expected,actual_on_hand:Number(entry.value),unit:entry.unit})}),data=await response.json();
      if(!response.ok||!data.ok){persist({...draftRef.current,[id]:{...entry,status:"error",conflict:data.conflict===true,error:data.error||"Could not save; tap Retry."}});return;}
      const verification=data.verification as Verification;
      setItems(old=>old.map(row=>row.item_id===id?{...row,on_hand:Number(data.on_hand),last_verification:verification}:row));
      persist({...draftRef.current,[id]:{...entry,expected:Number(data.on_hand),status:"saved",saved_at:verification.verified_at,error:undefined,conflict:false}});
    }catch(error){persist({...draftRef.current,[id]:{...entry,status:"error",error:error instanceof Error?error.message:"Connection interrupted. Tap Retry."}});}
    finally{inFlight.current.delete(id);setSaving(old=>({...old,[id]:false}));}
  }
  async function savePending(){if(bulkSaving)return;setBulkSaving(true);try{for(const item of pending)await saveCount(item);}finally{setBulkSaving(false);}}
  async function assignItem(item:Item){
    if(inFlight.current.size||item.assigned||!item.is_active)return;
    const id=item.item_id;inFlight.current.add(id);setSaving(old=>({...old,[id]:true}));setMessage("");
    try{
      const response=await authFetch("/api/inventory-accuracy/assign",{method:"POST",body:JSON.stringify({item_id:id,area_id:areaId})}),data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Could not add item to this area.");
      setItems(old=>old.map(row=>row.item_id===id?{...row,assigned:true,on_hand:data.stock.on_hand,shelf:data.stock.shelf,updated_at:data.stock.updated_at,unit:data.unit,locations:[...row.locations.filter(location=>location.area_id!==areaId),{area_id:areaId,area_name:selectedArea,active:true,on_hand:data.stock.on_hand}]}:row));
      const next={...draftRef.current};delete next[id];persist(next);
      setMessage(`${item.name} is now assigned to ${selectedArea}. Enter its actual count below.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Could not add item to this area.");}
    finally{inFlight.current.delete(id);setSaving(old=>({...old,[id]:false}));}
  }
  async function print(){
    if(inFlight.current.size){setMessage("Wait for the live count save to finish, then tap Print inventory sheet again.");return;}
    setPrinting(true);setMessage("");
    try{
      const response=await authFetch(`/api/inventory-accuracy?area_id=${encodeURIComponent(areaId)}`),data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Could not refresh the inventory sheet. Try again when connected.");
      setItems(data.items||[]);setPrintedAt(new Date().toLocaleString());window.setTimeout(()=>window.print(),0);
    }catch(error){setMessage(error instanceof Error?error.message:"Could not prepare the latest inventory sheet.");}
    finally{setPrinting(false);}
  }

  return <><style>{css}</style><main className="acc"><div className="acc-wrap">
    {editing&&<AccuracyItemEditor itemId={editing.item_id} areaId={areaId} areaName={selectedArea} authFetch={authFetch} onClose={()=>setEditing(null)} onSaved={(details,unitsChanged)=>{
      const id=editing.item_id;
      setItems(old=>old.map(item=>item.item_id===id?{...item,name:String(details.name),reference_number:details.reference_number as string|null,vendor:details.vendor as string|null,category:details.category as string|null,unit:details.unit as string|null,shelf:details.shelf as string|null,last_verification:unitsChanged?null:item.last_verification}:item));
      if(unitsChanged){const next={...draftRef.current};delete next[id];persist(next);}
      setEditing(null);setMessage(unitsChanged?"Item info saved. Recount this item in its updated unit; other entered counts were kept.":"Item info saved. Your entered counts were kept.");
    }}/>}
    <div className="acc-tools"><button onClick={()=>{if(!inFlight.current.size)router.push(returnToReorder?"/smart-reorder":"/");}} disabled={busy}>← Back</button><button onClick={()=>void print()} disabled={loading||busy||!areaItems.length}>{printing?"Preparing latest counts…":"Print inventory sheet"}</button><button onClick={()=>void loadArea(areaId)} disabled={loading||busy}>Reload live counts</button></div>
    <section className="acc-hero"><h1>Inventory Accuracy</h1><p>Enter the actual quantity in the displayed unit. Tap the next field, press Enter, or tap Save now to update live on-hand stock. Enter 0 when none remain; leaving a field blank does not change stock.</p><p className="acc-safe">Your entries are retained on this device as you type. <strong>Green “Saved to live inventory”</strong> confirms the database update. Unsaved entries stay visible when you reopen the app; tap Save unsaved counts to finish them.</p></section>
    {message&&<div className="acc-message" role="status">{message}</div>}
    <div className="acc-tools"><select aria-label="Area being counted" value={areaId} onChange={event=>void loadArea(event.target.value)} disabled={loading||busy}>{areas.map(area=><option key={area.id} value={area.id}>{area.name}{area.is_main?" · Main":""}</option>)}</select><input className="acc-search" aria-label="Search inventory" value={search} onChange={event=>{setSearch(event.target.value);setFilter("ALL");setAreaOnly(false);setLimit(100);}} placeholder="Search all inventory: name, reference, barcode…"/></div>
    <div className="acc-stats"><div className="acc-stat"><strong>{areaItems.length}</strong><span>Items in area</span></div><div className="acc-stat"><strong>{entered.length}</strong><span>Entered and retained</span></div><div className="acc-stat"><strong>{pending.length}</strong><span>Need saving / review</span></div></div>
    <div className="acc-tools"><button className="acc-filter" aria-pressed={areaOnly} onClick={()=>{setAreaOnly(value=>!value);setSearch("");setLimit(100);}}>This area only</button>{(["ALL","ENTERED","UNSAVED","VERIFIED"] as Filter[]).map(value=><button className="acc-filter" key={value} aria-pressed={filter===value&&(value!=="ALL"||!areaOnly)} onClick={()=>{setFilter(value);if(value==="ALL")setAreaOnly(false);setSearch("");setLimit(100);}}>{value==="ALL"?"All inventory":value==="ENTERED"?"Entered":value==="UNSAVED"?"Unsaved":"Previously verified"}</button>)}<button className="primary" onClick={()=>void savePending()} disabled={loading||busy||pending.length===0}>Save {pending.length} unsaved counts</button></div>
    <p>{loading?"Loading live counts…":`${filtered.length} matching items · ${items.length} items in the full catalog. Search includes all areas and inactive items. Print includes assigned items in ${selectedArea}.`}</p>
    {!loading&&<div className="acc-list">{filtered.slice(0,limit).map(item=>{
      const entry=drafts[item.item_id],isSaving=saving[item.item_id],changedSinceSave=entry?.status==="saved"&&Number(entry.value)!==item.on_hand;
      return <article className={`acc-item ${entry?.status||""}`} key={item.item_id}><div className="acc-head"><div><div className="acc-name">{item.name}{!item.is_active?" · Inactive":!item.assigned?" · Not assigned here":""}</div><div className="acc-meta">{item.vendor||"—"} · Ref: {item.reference_number||"—"}<br/>Count unit: <strong>{item.unit||"Not set"}</strong>{item.shelf?` · Shelf: ${item.shelf}`:""}</div></div><div className="acc-current"><strong>{item.assigned?(item.on_hand??"Unknown"):"—"}</strong><span>{item.assigned?"LIVE ON HAND":"NOT ASSIGNED"}</span></div></div>
        <div className="acc-meta">{item.locations.filter(location=>location.area_id!==areaId).map(location=><div key={location.area_id}>Also in {location.area_name}: {location.on_hand??"Unknown"} {item.unit||""}{location.active&&<button disabled={busy} onClick={()=>void loadArea(location.area_id)}>Count there</button>}</div>)}</div>
        {!item.is_active?<p>Inactive item. Reactivate it in Inventory before counting.</p>:!item.assigned?<div className="acc-actions"><button disabled={busy} onClick={()=>void assignItem(item)}>{isSaving?"Adding…":`Count in ${selectedArea}`}</button></div>:<div className="acc-actions"><button disabled={busy} onClick={()=>{if(!inFlight.current.size)setEditing(item);}}>✎ Edit Item Info</button></div>}
        {item.assigned&&item.is_active&&<><label className="acc-label">Actual count ({item.unit||"confirm unit"})<input className="acc-input" type="text" inputMode="numeric" value={entry?.value??""} onChange={event=>setCount(item,event.target.value)} onBlur={()=>void saveCount(item)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.blur();}}} disabled={Boolean(isSaving)||bulkSaving||printing} placeholder="Enter actual count"/></label>
        {entry&&entry.value!==""&&<div className={`acc-status ${entry.status}`} role="status">{isSaving?"Saving to live inventory…":entry.status==="saved"?`✓ Saved to live inventory ${entry.saved_at?new Date(entry.saved_at).toLocaleString():""}${changedSinceSave?". Live stock has changed since this count; check before re-entering.":""}`:entry.status==="error"?entry.error:"Retained on this device — finish this field to save live."}</div>}
        {entry?.value!==undefined&&entry.value!==""&&entry.status!=="saved"&&<div className="acc-actions">{entry.conflict?<button disabled={busy} onClick={()=>void loadArea(areaId)}>Reload, check, and re-enter</button>:<button disabled={Boolean(isSaving)} onClick={()=>void saveCount(item)}>{isSaving?"Saving…":entry.status==="error"?"Retry save":"Save now"}</button>}</div>}
        </>}
        {item.last_verification&&<div className="acc-meta">Last verified {new Date(item.last_verification.verified_at).toLocaleString()} by {item.last_verification.verified_by}</div>}
      </article>;
    })}</div>}
    {!loading&&!filtered.length&&<div className="acc-empty">No items match this view.</div>}
    {filtered.length>limit&&<div className="acc-tools"><button onClick={()=>setLimit(value=>value+100)}>Show 100 more</button></div>}
    <section className="acc-print"><h1>Baxter ASC — Inventory Sheet</h1><p>Area: {selectedArea} · Printed: {printedAt}<br/>Live on hand is the last loaded/saved database count. Unsaved entries are labeled separately and have not updated inventory. A blank actual-count cell means no entry on this device.</p><table><thead><tr>{["Item","Reference","Vendor","Shelf","Unit","Live on hand","Entered actual","Entry status","Last verified","Verified by"].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{areaItems.map(item=>{const entry=drafts[item.item_id];return <tr key={item.item_id}><td>{item.name}{!item.is_active?" (inactive)":""}</td><td>{item.reference_number}</td><td>{item.vendor}</td><td>{item.shelf}</td><td>{item.unit||"Not set"}</td><td>{item.on_hand}</td><td>{entry?.value??""}</td><td>{entry?.value!==undefined&&entry.value!==""?entry.status==="saved"?"Saved":"UNSAVED — review":"Not entered"}</td><td>{item.last_verification?new Date(item.last_verification.verified_at).toLocaleString():"Not verified"}</td><td>{item.last_verification?.verified_by||""}</td></tr>;})}</tbody></table></section>
  </div></main></>;
}
