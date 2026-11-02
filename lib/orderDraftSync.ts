export type DraftEntry={qty:string;note:string;review:boolean};
export type DraftEntries=Record<string,DraftEntry>;
export type DraftChange={item_id:string;qty?:string;note?:string;before_qty?:string;before_note?:string};
export type DraftOperation={id:string;kind:"import"|"patch"|"remove"|"ack";changes:DraftChange[]};
export type DraftSnapshot={entries:DraftEntries;revision:number};
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readLegacyDraft(value:unknown):DraftChange[]{
 if(!value||typeof value!=="object")throw new Error("The saved device draft is invalid. It has not been deleted.");
 const legacy=value as {items?:Record<string,unknown>;notes?:Record<string,unknown>};
 if(!legacy.items||typeof legacy.items!=="object"||Array.isArray(legacy.items))throw new Error("The saved device draft is invalid. It has not been deleted.");
 return Object.entries(legacy.items).map(([id,qty])=>{
   const q=String(qty);
   if(!UUID.test(id)||!/^\d{0,9}$/.test(q))throw new Error("A saved draft item needs recovery. The original list is preserved.");
   const note=legacy.notes?.[id];
   if(note!==undefined&&typeof note!=="string")throw new Error("A saved order note needs recovery. The original list is preserved.");
   if(typeof note==="string"&&note.length>10000)throw new Error("A saved note is too long to sync; the original list is preserved.");
   return {item_id:id,qty:q,note:(note as string|undefined)||""};
 });
}

// Apply only local, unacknowledged edits over the last server snapshot.
// A server response never replaces edits made while that request was in flight.
export function projectDraft(entries:DraftEntries,queue:DraftOperation[]):DraftEntries{
 const result:DraftEntries=structuredClone(entries);
 for(const op of queue)for(const c of op.changes){
   const current=result[c.item_id];
   if(op.kind==="remove"){delete result[c.item_id];continue;}
   if(op.kind==="ack"){if(current)result[c.item_id]={...current,review:false};continue;}
   if(!current&&c.qty===undefined)continue;
   const next={...(current||{qty:"",note:"",review:false})};
   if(op.kind==="import"&&current){
     if(c.qty!==undefined&&current.qty!==c.qty){next.qty=String(Math.max(Number(current.qty||0),Number(c.qty||0)));next.review=true;}
     if(c.note&&c.note!==current.note&&!current.note.includes(c.note)){next.note=[current.note,c.note].filter(Boolean).join("\n--- Other device note ---\n");next.review=Boolean(current.note)||next.review;}
   }else{
     if(c.qty!==undefined){next.qty=c.qty;next.review=false;}
     if(c.note!==undefined)next.note=c.note;
   }
   result[c.item_id]=next;
 }
 return result;
}

export function draftFields(entries:DraftEntries){
 const items:Record<string,number|string>={},notes:Record<string,string>={},review:Record<string,boolean>={};
 for(const [id,e] of Object.entries(entries)){items[id]=e.qty;notes[id]=e.note;review[id]=e.review;}
 return {items,notes,review};
}
