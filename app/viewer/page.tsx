"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@supabase/supabase-js";

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Item={id:string;name:string;reference_number:string|null;vendor:string|null;category:string|null;unit:string|null;par_level:number|null;low_level:number|null;price:number|null;notes:string|null;alert_note:string|null;is_active:boolean;order_status:string|null;backordered:boolean;expiration_date:string|null;on_hand:number;locations:{area:string;on_hand:number|null;shelf:string|null}[]};
type Order={id:string;created_at:string;item_name:string;reference_number:string|null;vendor:string|null;unit:string|null;qty_requested:number|null;qty_actual_ordered:number|null;qty_actual_received:number|null;status:string;requested_by:string|null;confirmed_by:string|null;confirmed_at:string|null;received_at:string|null;expected_delivery_date:string|null;notes:string|null;item_note:string|null;issue_note:string|null;receipt_exception_note:string|null};
type Data={items:Item[];orders:Order[];updated_at:string};
const date=(value:string|null)=>value?new Date(value.length===10?value+"T12:00:00":value).toLocaleDateString():"—";
const money=(value:number|null)=>value===null?"Not entered":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);

export default function InventoryViewer(){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState("");
  const [signedIn,setSignedIn]=useState(false),[initializing,setInitializing]=useState(true),[needsPassword,setNeedsPassword]=useState(false),[invite,setInvite]=useState<string|null>(null);
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [tab,setTab]=useState<"inventory"|"orders">("inventory"),[search,setSearch]=useState(""),[status,setStatus]=useState("ALL"),[includeInactive,setIncludeInactive]=useState(false);
  const [limit,setLimit]=useState(100);
  const refresh=useCallback(async()=>{
    setRefreshing(true);
    try{
      const {data:auth}=await supabase.auth.getSession();
      if(!auth.session){setSignedIn(false);setData(null);return;}
      const response=await fetch("/api/viewer",{headers:{Authorization:`Bearer ${auth.session.access_token}`},cache:"no-store"});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not refresh inventory.");
      setData(result);setSignedIn(true);setEmail(auth.session.user.email||"");setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not load inventory.");}
    finally{setRefreshing(false);}
  },[]);
  useEffect(()=>{
    let active=true;
    const token=new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if(token){setInvite(token);window.history.replaceState(null,"","/viewer");}
    void supabase.auth.getSession().then(async({data:auth})=>{if(!active)return;if(auth.session){setSignedIn(true);setNeedsPassword(auth.session.user.user_metadata?.viewer_setup_required===true);await refresh();}if(active)setInitializing(false);});
    return()=>{active=false;};
  },[refresh]);
  useEffect(()=>{
    if(!signedIn||needsPassword)return;
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},30000);
    const focused=()=>void refresh();window.addEventListener("focus",focused);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",focused);};
  },[signedIn,needsPassword,refresh]);
  async function activate(){
    if(!invite)return;setBusy(true);setError("");
    try{const {error}=await supabase.auth.verifyOtp({token_hash:invite,type:"invite"});if(error)throw error;setInvite(null);setNeedsPassword(true);setSignedIn(true);setPassword("");}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not activate account.");}finally{setBusy(false);}
  }
  async function login(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword("");await refresh();}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not sign in.");}finally{setBusy(false);}
  }
  async function savePassword(event:React.FormEvent){
    event.preventDefault();if(password.length<12||password!==confirmPassword){setError("Use at least 12 characters and enter the same password twice.");return;}
    setBusy(true);setError("");try{const {error}=await supabase.auth.updateUser({password,data:{viewer_setup_required:false}});if(error)throw error;setNeedsPassword(false);setPassword("");setConfirmPassword("");await refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Could not save password.");}finally{setBusy(false);}
  }
  async function signOut(){await supabase.auth.signOut();localStorage.removeItem("asc_session_token");localStorage.removeItem("asc_user_email");setSignedIn(false);setNeedsPassword(false);setData(null);setPassword("");}
  const query=search.trim().toLowerCase();
  const inventory=useMemo(()=>data?.items.filter(i=>(includeInactive||i.is_active)&&(!query||[i.name,i.reference_number,i.vendor,i.category,...i.locations.map(l=>l.area+" "+(l.shelf||""))].some(v=>v?.toLowerCase().includes(query))))||[],[data,query,includeInactive]);
  const orders=useMemo(()=>data?.orders.filter(o=>(status==="ALL"||o.status===status)&&(!query||[o.item_name,o.reference_number,o.vendor,o.requested_by,o.status].some(v=>v?.toLowerCase().includes(query))))||[],[data,query,status]);
  const statuses=useMemo(()=>[...new Set(data?.orders.map(o=>o.status)||[])].sort(),[data]);
  const errorBox=error&&<p role="alert" className="viewer-error">{error}{data?" The displayed information is from the last successful refresh.":""}</p>;
  return <main className="viewer">
    <style>{`
      .viewer{max-width:1440px;margin:0 auto;padding:28px 24px 70px;color:#e2e8f0;font-family:system-ui,sans-serif}.viewer h1{margin:6px 0 8px;font-size:30px;line-height:1.15}.viewer h2{margin:0 0 18px}.viewer p{line-height:1.6}.viewer .muted{color:#94a3b8;font-size:13px}.viewer button,.viewer input,.viewer select{font:inherit;border:1px solid #3c5270;border-radius:9px;padding:10px 13px;background:#152238;color:#e2e8f0}.viewer button{cursor:pointer}.viewer button:disabled{opacity:.5;cursor:wait}.viewer button[aria-selected=true],.viewer .primary{background:#2563eb;color:white;border-color:#60a5fa}.viewer label{display:grid;gap:7px;margin-bottom:15px}.viewer .viewer-header,.viewer .viewer-tools{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.viewer .viewer-tools{justify-content:flex-start;margin:20px 0}.viewer .viewer-tools input[type=search]{min-width:260px;flex:1}.viewer .viewer-tools label{display:flex;align-items:center;margin:0}.viewer .badge{display:inline-block;background:#143647;border:1px solid #307889;color:#a5f3fc;padding:5px 9px;border-radius:20px;font-size:12px}.viewer .stats{display:flex;gap:18px;flex-wrap:wrap;margin:20px 0;padding:17px;background:#111c2e;border-radius:12px}.viewer .viewer-table{overflow-x:auto;border:1px solid #2c3d55;border-radius:12px}.viewer table{width:100%;border-collapse:collapse;font-size:14px;min-width:920px}.viewer th{text-align:left;color:#93c5fd;background:#152238;padding:14px 12px}.viewer td{vertical-align:top;padding:13px 12px;border-top:1px solid #293a51;line-height:1.45}.viewer tbody tr:nth-child(even){background:#111b2b}.viewer details{margin-top:8px}.viewer summary{cursor:pointer;color:#93c5fd}.viewer .viewer-auth{max-width:440px;margin:60px auto;padding:28px;border:1px solid #344963;background:#111c2e;border-radius:18px}.viewer .viewer-auth input{width:100%;box-sizing:border-box}.viewer .viewer-error{padding:13px;background:#451c29;border:1px solid #be586d;border-radius:10px;color:#fecdd3}.viewer small{display:block;color:#94a3b8;margin-top:5px}.viewer .qty{font-size:18px;font-weight:700;white-space:nowrap}.viewer .viewer-tabs{display:flex;gap:8px;margin-top:24px}.viewer .warning{color:#fbbf24}.viewer .show-more{margin-top:18px}@media(max-width:600px){.viewer{padding:20px 14px}.viewer h1{font-size:25px}.viewer .viewer-auth{margin:30px auto}.viewer .viewer-tools input[type=search]{min-width:0;width:100%}}
    `}</style>
    {initializing?<p role="status">Loading account…</p>:invite?<section className="viewer-auth"><span className="badge">View-only access</span><h1>Welcome, Annette</h1><p>Activate your account to see live inventory and order requests. You’ll choose your own password.</p>{errorBox}<button className="primary" disabled={busy} onClick={()=>void activate()}>{busy?"Activating…":"Activate account"}</button></section>:needsPassword?<form className="viewer-auth" onSubmit={savePassword}><h1>Choose your password</h1><p>You’ll use your email and this password to sign in again.</p>{errorBox}<label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?"Saving…":"Save password and open inventory"}</button></form>:!signedIn?<form className="viewer-auth" onSubmit={login}><span className="badge">View-only access</span><h1>Baxter ASC</h1><p>Sign in to view live inventory and order requests.</p>{errorBox}<label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>:<>
      <header className="viewer-header"><div><span className="badge">View-only access</span><h1>Inventory &amp; Order Requests</h1><div className="muted">Baxter ASC · {email}</div></div><div><button onClick={()=>void refresh()} disabled={refreshing}>{refreshing?"Refreshing…":"Refresh now"}</button> <button onClick={()=>void signOut()}>Sign out</button></div></header>
      <p className="muted">Live on-hand balances from Inventory. Refreshes every 30 seconds while this page is open. {data&&`Last updated ${new Date(data.updated_at).toLocaleString()}.`}</p>
      {errorBox}
      <div className="stats"><span><b>{data?.items.filter(i=>i.is_active).length??"—"}</b> active inventory items</span><span><b>{data?.orders.filter(o=>o.status==="PENDING").length??"—"}</b> pending order requests</span><span><b>{data?.orders.filter(o=>["ORDERED","BACKORDERED","AWAITING"].includes(o.status)).length??"—"}</b> ordered / awaiting</span></div>
      <div className="viewer-tabs" role="tablist" aria-label="Live inventory views"><button role="tab" id="viewer-inventory-tab" aria-controls="viewer-inventory-panel" aria-selected={tab==="inventory"} onClick={()=>{setTab("inventory");setSearch("");setLimit(100);}}>Inventory</button><button role="tab" id="viewer-orders-tab" aria-controls="viewer-orders-panel" aria-selected={tab==="orders"} onClick={()=>{setTab("orders");setSearch("");setLimit(100);}}>Order requests</button></div>
      <div className="viewer-tools"><input type="search" aria-label={tab==="inventory"?"Search inventory":"Search order requests"} placeholder="Search name, reference, or vendor…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(100);}}/>{tab==="inventory"?<label><input type="checkbox" checked={includeInactive} onChange={e=>{setIncludeInactive(e.target.checked);setLimit(100);}}/>Include inactive items</label>:<select aria-label="Order request status" value={status} onChange={e=>{setStatus(e.target.value);setLimit(100);}}><option value="ALL">All order statuses</option>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>}</div>
      <section role="tabpanel" id={`viewer-${tab}-panel`} aria-labelledby={`viewer-${tab}-tab`}>
      <p className="muted">{tab==="inventory"?inventory.length:orders.length} matching {tab==="inventory"?"inventory items":"order requests"}</p>
      <div className="viewer-table">{tab==="inventory"?<table><thead><tr><th>Item / reference</th><th>Vendor / category</th><th>On hand</th><th>Unit</th><th>PAR / low</th><th>Saved price</th><th>Locations / details</th></tr></thead><tbody>{inventory.slice(0,limit).map(i=><tr key={i.id}><td><strong>{i.name}</strong><small>Ref: {i.reference_number||"Not set"}{!i.is_active?" · Inactive":""}</small><small>{i.order_status}{i.backordered?" · Backordered":""}</small></td><td>{i.vendor||"—"}<small>{i.category||""}</small></td><td><span className="qty">{i.on_hand}</span>{(i.par_level??0)>0&&i.on_hand<=(i.low_level??0)&&<small className="warning">At / below low level</small>}</td><td>{i.unit||"Not set"}</td><td>{i.par_level??"—"} / {i.low_level??"—"}</td><td>{money(i.price)}</td><td>{i.locations.length?<details><summary>{i.locations.length} location{i.locations.length===1?"":"s"}</summary>{i.locations.map((l,n)=><small key={n}>{l.area}: {l.on_hand??"Unknown"} {i.unit||""}{l.shelf?` · ${l.shelf}`:""}</small>)}</details>:"No location detail"}{(i.notes||i.alert_note||i.expiration_date)&&<details><summary>Item notes</summary>{i.notes&&<p>{i.notes}</p>}{i.alert_note&&<p>{i.alert_note}</p>}{i.expiration_date&&<p>Expiry: {date(i.expiration_date)}</p>}</details>}</td></tr>)}{!inventory.length&&<tr><td colSpan={7}>No inventory items match this search.</td></tr>}</tbody></table>:<table><thead><tr><th>Item / reference</th><th>Status</th><th>Requested</th><th>Ordered</th><th>Received</th><th>Dates / requested by</th><th>Notes</th></tr></thead><tbody>{orders.slice(0,limit).map(o=><tr key={o.id}><td><strong>{o.item_name}</strong><small>Ref: {o.reference_number||"—"}</small><small>{o.vendor||""}</small></td><td>{o.status.replaceAll("_"," ")}</td><td>{o.qty_requested??"—"} {o.unit||""}</td><td>{o.qty_actual_ordered??"—"}</td><td>{o.qty_actual_received??"—"}</td><td>Requested: {date(o.created_at)}<small>{o.requested_by||""}</small>{o.confirmed_at&&<small>Ordered: {date(o.confirmed_at)}{o.confirmed_by?` · ${o.confirmed_by}`:""}</small>}{o.expected_delivery_date&&<small>Expected: {date(o.expected_delivery_date)}</small>}{o.received_at&&<small>Received: {date(o.received_at)}</small>}</td><td>{[o.notes,o.item_note,o.issue_note,o.receipt_exception_note].filter(Boolean).map((note,n)=><p key={n}>{note}</p>)}</td></tr>)}{!orders.length&&<tr><td colSpan={7}>No order requests match this search.</td></tr>}</tbody></table>}</div>
      {(tab==="inventory"?inventory.length:orders.length)>limit&&<button className="show-more" onClick={()=>setLimit(l=>l+100)}>Show 100 more</button>}
      </section>
    </>}
  </main>;
}
