"use client";
import {useEffect,useRef,useState} from "react";
import type {Dispatch,SetStateAction} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {draftFields,projectDraft,readLegacyDraft} from "@/lib/orderDraftSync";
import type {DraftEntries,DraftOperation,DraftSnapshot} from "@/lib/orderDraftSync";

type Saved={cache:DraftSnapshot;queue:DraftOperation[];legacyQueued:boolean};
type LocalState=Saved&{userId:string;key:string};
const EMPTY:DraftSnapshot={entries:{},revision:0};

export function useCloudOrderDraft(supabase:SupabaseClient){
 const [view,setView]=useState<DraftEntries>({});
 const [ready,setReady]=useState(false);
 const [syncing,setSyncing]=useState(false);
 const [error,setError]=useState("");
 const [lastSynced,setLastSynced]=useState("");
 const state=useRef<LocalState|null>(null);
 const visible=useRef<DraftEntries>({});
 const active=useRef(false);
 const storageError=useRef("");
 const inFlight=useRef<Promise<DraftSnapshot>|null>(null);
 const debounce=useRef<ReturnType<typeof setTimeout>|null>(null);
 const syncNow=useRef<()=>Promise<DraftSnapshot>>(async()=>EMPTY);

 function persist(){
   const s=state.current;if(!s)return;
   try{
     const saved:Saved={cache:s.cache,queue:s.queue,legacyQueued:s.legacyQueued};
     localStorage.setItem(s.key,JSON.stringify(saved));
     storageError.current="";
   }catch{storageError.current="Device backup could not be saved. Keep this page open until cloud sync finishes.";}
 }
 function publish(){
   const s=state.current;if(!s)return;
   visible.current=projectDraft(s.cache.entries,s.queue);
   if(active.current)setView(visible.current);
 }
 function queue(op:DraftOperation){
   const s=state.current;if(!s)return;
   s.queue=[...s.queue,op];
   persist();publish();
   if(active.current&&storageError.current)setError(storageError.current);
   // Queue is stored synchronously before network work, including if the app closes.
   if(debounce.current)clearTimeout(debounce.current);
   debounce.current=setTimeout(()=>{void syncNow.current().catch(()=>{});},300);
 }
 async function sync():Promise<DraftSnapshot>{
   if(inFlight.current)return inFlight.current;
   const s=state.current;if(!s)throw new Error("Draft is still loading.");
   const task=(async()=>{
     if(active.current)setSyncing(true);
     const sent=s.queue.slice(0,100),sentIds=new Set(sent.map(o=>o.id));
     let succeeded=false;
     try{
       const {data}=await supabase.auth.getSession();
       if(data.session?.user.id!==s.userId)throw new Error("Sign in to the same account to sync this list.");
       const controller=new AbortController();
       const timer=setTimeout(()=>controller.abort(),15000);
       let response:Response;
       try{
         response=await fetch("/api/order-drafts",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:"Bearer "+data.session.access_token},body:JSON.stringify({operations:sent}),signal:controller.signal});
       }finally{clearTimeout(timer);}
       const json=await response.json();
       if(!response.ok||!json.ok||!json.entries||typeof json.revision!=="number")throw new Error(json.error||"Draft sync failed.");
       s.cache={entries:json.entries,revision:json.revision};
       s.queue=s.queue.filter(o=>!sentIds.has(o.id));
       persist();publish();succeeded=true;
       if(active.current){setLastSynced(new Date().toLocaleTimeString());setError(storageError.current);}
       return s.cache;
     }catch(e){
       const message=e instanceof Error?e.message:"Draft sync failed.";
       if(active.current)setError(message+" Your unsynced changes remain on this device. Open both devices with the same account and tap Sync Now.");
       throw e;
     }finally{
       if(active.current)setSyncing(false);
       inFlight.current=null;
       if(succeeded&&s.queue.length&&active.current)setTimeout(()=>{void syncNow.current().catch(()=>{});},0);
     }
   })();
   inFlight.current=task;
   return task;
 }
 syncNow.current=sync;

 useEffect(()=>{
   active.current=true;
   let stopped=false;
   void (async()=>{
     try{
       const {data}=await supabase.auth.getSession();
       if(stopped)return;
       if(!data.session)throw new Error("Sign in to sync your order list.");
       const userId=data.session.user.id,key="asc-order-draft-v2:"+userId;
       const raw=localStorage.getItem(key);
       const saved:Saved=raw?JSON.parse(raw):{cache:EMPTY,queue:[],legacyQueued:false};
       if(!saved.cache?.entries||!Array.isArray(saved.queue))throw new Error("Device draft backup needs recovery. It has not been replaced.");
       const local:LocalState={...saved,userId,key};
       if(!local.legacyQueued){
         const old=localStorage.getItem("asc-order-draft-v1:"+userId);
         const changes=old?readLegacyDraft(JSON.parse(old)):[];
         if(changes.length)local.queue=[...local.queue,{id:crypto.randomUUID(),kind:"import",changes}];
         local.legacyQueued=true;
       }
       state.current=local;persist();publish();setReady(true);
       await syncNow.current();
     }catch(e){if(!stopped)setError(e instanceof Error?e.message:"Draft could not load.");}
   })();
   const resume=()=>{if(document.visibilityState==="visible"&&state.current)void syncNow.current().catch(()=>{});};
   const interval=setInterval(resume,5000);
   window.addEventListener("focus",resume);
   window.addEventListener("online",resume);
   document.addEventListener("visibilitychange",resume);
   return()=>{
     stopped=true;active.current=false;clearInterval(interval);
     if(debounce.current)clearTimeout(debounce.current);
     window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);
   };
 },[supabase]);

 const fields=draftFields(view);
 const setItems:Dispatch<SetStateAction<Record<string,number|string>>>=(value)=>{
   const before=draftFields(visible.current).items;
   const after=typeof value==="function"?value(before):value;
   const patches:DraftOperation["changes"]=[],removes:DraftOperation["changes"]=[];
   for(const id of new Set([...Object.keys(before),...Object.keys(after)])){
     if(after[id]===undefined){
       const entry=visible.current[id];if(entry)removes.push({item_id:id,before_qty:entry.qty,before_note:entry.note});
     }else if(String(before[id]??"")!==String(after[id])||before[id]===undefined){
       patches.push({item_id:id,qty:String(after[id]),before_qty:before[id]===undefined?undefined:String(before[id])});
     }
   }
   if(patches.length)queue({id:crypto.randomUUID(),kind:"patch",changes:patches});
   if(removes.length)queue({id:crypto.randomUUID(),kind:"remove",changes:removes});
 };
 const setNotes:Dispatch<SetStateAction<Record<string,string>>>=(value)=>{
   const before=draftFields(visible.current).notes;
   const after=typeof value==="function"?value(before):value;
   const changes:DraftOperation["changes"]=[];
   for(const id of new Set([...Object.keys(before),...Object.keys(after)])){
     if(visible.current[id]&&(before[id]||"")!==(after[id]||""))changes.push({item_id:id,note:after[id]||"",before_note:before[id]||""});
   }
   if(changes.length)queue({id:crypto.randomUUID(),kind:"patch",changes});
 };
 async function flush(){
   let snapshot=await syncNow.current();
   // Drain edits typed during an in-flight request before permitting submission.
   for(let attempt=0;state.current?.queue.length;attempt++){
     if(attempt>20)throw new Error("Still syncing changes. Please try again.");
     snapshot=await syncNow.current();
   }
   return snapshot;
 }
 function confirmItem(id:string){
   const e=visible.current[id];if(e)queue({id:crypto.randomUUID(),kind:"ack",changes:[{item_id:id,before_qty:e.qty,before_note:e.note}]});
 }
 async function removeSent(entries:DraftEntries){
   const changes=Object.entries(entries).map(([item_id,e])=>({item_id,before_qty:e.qty,before_note:e.note}));
   if(changes.length)queue({id:crypto.randomUUID(),kind:"remove",changes});
   await flush();
 }
 return {...fields,setItems,setNotes,ready,syncing,error,lastSynced,flush,confirmItem,removeSent};
}
