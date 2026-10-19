"use client";
import {useEffect,useRef,useState} from "react";

type Details = Record<string,string|number|null>;
type Props = {
  itemId:string; areaId:string; areaName:string;
  authFetch:(url:string,options?:RequestInit)=>Promise<Response>;
  onClose:()=>void;
  onSaved:(details:Details,unitsChanged:boolean)=>void;
};
const inputs = [
  ["name","Item name","text"], ["reference_number","Reference / vendor item number","text"],
  ["vendor","Vendor","text"], ["category","Category","text"],
  ["unit","Inventory count unit (EA, BX, CS…)","text"], ["units_per_box","Individual items per box","number"],
  ["par_level","Building PAR target (in count units)","number"], ["low_level","Building low-stock level (in count units)","number"],
  ["price","Saved package price ($)","number"], ["shelf","Shelf in this area only","text"],
] as const;
export default function AccuracyItemEditor({itemId,areaId,areaName,authFetch,onClose,onSaved}:Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [original,setOriginal] = useState<Details|null>(null), [draft,setDraft] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true), [saving,setSaving] = useState(false), [error,setError] = useState("");
  const [confirmUnits,setConfirmUnits] = useState(false);
  useEffect(()=>{
    const element=dialog.current; element?.showModal();
    let cancelled=false;
    void (async()=>{
      try {
        const response=await authFetch(`/api/inventory-accuracy/item?item_id=${encodeURIComponent(itemId)}&area_id=${encodeURIComponent(areaId)}`),data=await response.json();
        if(!response.ok||!data.ok)throw new Error(data.error||"Could not load item info");
        if(cancelled)return;
        setOriginal(data.item);setDraft(Object.fromEntries(Object.entries(data.item).map(([key,value])=>[key,value===null?"":String(value)])));
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Could not load item info");}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;element?.close();};
  },[itemId,areaId,authFetch]);
  const unitChange=Boolean(original&&((draft.unit.trim()||null)!==original.unit||(draft.units_per_box===""?null:Number(draft.units_per_box))!==original.units_per_box));
  async function save(event:React.FormEvent) {
    event.preventDefault();if(saving||!original)return;
    setSaving(true);setError("");
    try {
      const details:Details={};
      for(const [key,,type] of inputs) details[key]=type==="number"?(draft[key]===""?null:Number(draft[key])):draft[key].trim()||null;
      details.notes=draft.notes.trim()||null;details.alert_note=draft.alert_note.trim()||null;
      const response=await authFetch("/api/inventory-accuracy/item",{method:"PATCH",body:JSON.stringify({item_id:itemId,area_id:areaId,expected:original,details,confirm_units:confirmUnits})}),data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Could not save item info");
      onSaved(data.details,Boolean(data.units_changed));
    }catch(e){setError(e instanceof Error?e.message:"Could not save item info");}
    finally{setSaving(false);}
  }
  return <dialog className="accuracy-edit" ref={dialog} aria-labelledby="accuracy-edit-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}} style={{width:"min(650px,calc(100% - 24px))",maxHeight:"90dvh",padding:0,border:"1px solid #334e72",borderRadius:18,background:"#111c2e",color:"#f1f5f9"}}>
    <style>{`.accuracy-edit::backdrop{background:rgba(0,0,0,.75)}.accuracy-edit label{display:block;font-size:12px;font-weight:700;color:#b4c5dc}.accuracy-edit input:not([type=checkbox]),.accuracy-edit textarea{display:block;width:100%;background:#0b1322;color:white;border:1px solid #385173;border-radius:9px;padding:10px;margin-top:5px;font:14px system-ui}.accuracy-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.accuracy-edit button{cursor:pointer;padding:11px 15px;border-radius:10px;border:1px solid #385173;background:#243750;color:white;font-weight:800}.accuracy-edit button:disabled{opacity:.5;cursor:wait}.accuracy-edit input:focus-visible,.accuracy-edit textarea:focus-visible,.accuracy-edit button:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}`}</style>
    <div className="accuracy-edit" style={{padding:20,fontFamily:"system-ui"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><h2 id="accuracy-edit-title" style={{margin:0,fontSize:21}}>Edit Item Info</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Close item editor">Close</button></div>
      <p style={{fontSize:12,lineHeight:1.5,color:"#a9bad1"}}>Product details and building PAR apply everywhere this item appears. Shelf applies only to <strong>{areaName}</strong>. Saving info keeps your other entered counts.</p>
      {error&&<p role="alert" style={{color:"#fca5a5",fontSize:13}}>{error}</p>}
      {loading?<p role="status">Loading current item info…</p>:original&&<form onSubmit={save}>
        <fieldset disabled={saving} style={{border:0,padding:0,margin:0}}>
          <div className="accuracy-edit-grid">{inputs.map(([key,label,type])=><label key={key}>{label}<input autoFocus={key==="name"} type={type} value={draft[key]??""} onChange={event=>{setDraft(old=>({...old,[key]:event.target.value}));if(key==="unit"||key==="units_per_box")setConfirmUnits(false);}} required={key==="name"} min={key==="units_per_box"?1:0} max={type==="number"?(key==="price"?10000000:1000000):undefined} maxLength={key==="name"?300:key==="shelf"?120:key==="unit"?80:200} step={key==="price"?"0.01":"1"}/></label>)}</div>
          <label style={{marginTop:12}}>Item notes<textarea rows={3} maxLength={2000} value={draft.notes||""} onChange={event=>setDraft(old=>({...old,notes:event.target.value}))}/></label>
          <label style={{marginTop:12}}>Ordering / box note<textarea rows={2} maxLength={500} value={draft.alert_note||""} onChange={event=>setDraft(old=>({...old,alert_note:event.target.value}))}/></label>
          <p style={{fontSize:12,color:"#a9bad1",lineHeight:1.5}}>Changing unit labels or items per box does not convert the stock numbers. Use the count unit shown here for PAR and actual counts. Confirm the saved price’s package basis before using it for spending estimates.</p>
          {unitChange&&<label style={{background:"#422f17",padding:12,borderRadius:10,lineHeight:1.5}}><input type="checkbox" checked={confirmUnits} onChange={event=>setConfirmUnits(event.target.checked)} style={{marginRight:9}}/>I understand: this item needs fresh counts in every area. Its entered draft count here will be cleared; other items’ drafts stay.</label>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={unitChange&&!confirmUnits} style={{background:"#2563eb"}}>{saving?"Saving…":"Save Item Info"}</button></div>
        </fieldset>
      </form>}
    </div>
  </dialog>;
}
