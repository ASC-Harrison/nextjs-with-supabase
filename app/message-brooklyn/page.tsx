"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type SentMessage = { id:string; created_at:string; sender_name:string; subject:string; message:string; delivery_status:string; read_at:string|null; read_by:string|null; response:string|null; responded_at:string|null; responded_by:string|null };

export default function MessageBrooklynPage() {
  const router = useRouter();
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [history,setHistory] = useState<SentMessage[]>([]);
  const [isBrooklyn,setIsBrooklyn] = useState(false);
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [replyingId,setReplyingId] = useState<string|null>(null);
  const [replyDrafts,setReplyDrafts] = useState<Record<string,string>>({});
  const [status,setStatus] = useState("");

  const authFetch = useCallback(async (url:string, options:RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Please sign in again.");
    return fetch(url, { ...options, headers:{ "Content-Type":"application/json", Authorization:`Bearer ${data.session.access_token}` } });
  }, []);

  const loadHistory = useCallback(async (quiet=false) => {
    try {
      const response = await authFetch("/api/message-brooklyn");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load messages");
      setHistory(data.messages || []);
      setIsBrooklyn(Boolean(data.is_brooklyn));
    } catch (error) {
      if (!quiet) setStatus(error instanceof Error ? error.message : "Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadHistory();
    const timer = window.setInterval(() => void loadHistory(true), 15000);
    const onFocus = () => void loadHistory(true);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [loadHistory]);

  async function sendNote() {
    if (!subject.trim() || !message.trim() || sending) return;
    if (!confirm("Email this note directly to Brooklyn?")) return;
    setSending(true); setStatus("");
    try {
      const response = await authFetch("/api/message-brooklyn", { method:"POST", body:JSON.stringify({subject,message}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send note");
      setHistory(previous => [data.message,...previous]);
      setSubject(""); setMessage(""); setStatus("✓ Email sent to Brooklyn.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send note");
    } finally { setSending(false); }
  }

  async function sendReply(id:string) {
    const responseText = (replyDrafts[id] || "").trim();
    if (!responseText || replyingId) return;
    setReplyingId(id); setStatus("");
    try {
      const response = await authFetch("/api/message-brooklyn", { method:"PATCH", body:JSON.stringify({id,response:responseText}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save reply");
      setHistory(previous => previous.map(item => item.id === id ? data.message : item));
      setReplyDrafts(previous => ({...previous,[id]:""}));
      setStatus("✓ Reply posted in the tab.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save reply");
    } finally { setReplyingId(null); }
  }

  function badge(item:SentMessage) {
    if (item.responded_at) return {text:"REPLIED",color:"#c4b5fd",bg:"rgba(139,92,246,.12)",border:"rgba(139,92,246,.3)"};
    if (item.read_at) return {text:"READ",color:"#6ee7b7",bg:"rgba(16,185,129,.1)",border:"rgba(16,185,129,.25)"};
    return {text:"SENT",color:"#93c5fd",bg:"rgba(59,130,246,.1)",border:"rgba(59,130,246,.25)"};
  }

  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 15% 0%,rgba(37,99,235,.2),transparent 35%),#080d19",color:"#f8fafc",padding:"16px 16px 70px",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <button onClick={()=>router.push("/")} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:10,color:"#94a3b8",padding:"9px 15px",fontWeight:800,cursor:"pointer",marginBottom:12}}>← Back</button>
      <section style={{background:"linear-gradient(145deg,#17233a,#101827)",border:"1px solid rgba(96,165,250,.25)",borderRadius:20,padding:20,marginBottom:14,boxShadow:"0 20px 50px rgba(0,0,0,.25)"}}>
        <div style={{fontSize:23,fontWeight:950}}>✉️ Brooklyn Messages</div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:5}}>{isBrooklyn ? "Read and respond to direct ASC notes" : "Send Brooklyn a note and see when she reads or replies"}</div>
        <div style={{marginTop:14,background:"rgba(37,99,235,.1)",border:"1px solid rgba(96,165,250,.22)",borderRadius:10,padding:"9px 11px",fontSize:12,color:"#93c5fd"}}>{isBrooklyn ? "Signed in as Brooklyn — opening this inbox marks new notes read." : <>Recipient is locked to <strong>Brooklyn</strong>.</>}</div>
      </section>

      {!isBrooklyn && <section style={{background:"#162032",border:"1px solid #1e3a5f",borderRadius:18,padding:18,marginBottom:14}}>
        <label style={{display:"block",fontSize:10,fontWeight:900,color:"#64748b",letterSpacing:".7px",marginBottom:6}}>SUBJECT</label>
        <input value={subject} maxLength={120} onChange={event=>setSubject(event.target.value)} placeholder="Example: Please follow up on this order" style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:10,color:"#f8fafc",padding:"12px 13px",fontSize:14,outline:"none",marginBottom:13}} />
        <label style={{display:"block",fontSize:10,fontWeight:900,color:"#64748b",letterSpacing:".7px",marginBottom:6}}>NOTE FOR BROOKLYN</label>
        <textarea value={message} maxLength={2000} onChange={event=>setMessage(event.target.value)} placeholder="Type the full note here…" rows={6} style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:10,color:"#f8fafc",padding:"12px 13px",fontSize:14,fontFamily:"inherit",lineHeight:1.5,resize:"vertical",outline:"none"}} />
        <div style={{fontSize:10,color:"#475569",textAlign:"right",marginTop:4}}>{message.length}/2000</div>
        <button disabled={sending || !subject.trim() || !message.trim()} onClick={sendNote} style={{width:"100%",marginTop:10,border:0,borderRadius:11,background:"#2563eb",color:"#fff",padding:13,fontSize:14,fontWeight:900,cursor:"pointer",opacity:sending || !subject.trim() || !message.trim() ? .5 : 1}}>{sending ? "Sending…" : "✉️ Send Email to Brooklyn"}</button>
      </section>}

      {status && <div style={{marginBottom:12,borderRadius:9,padding:"10px 12px",fontSize:12,color:status.startsWith("✓") ? "#6ee7b7" : "#fca5a5",background:status.startsWith("✓") ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)"}}>{status}</div>}

      <section>
        <div style={{fontSize:11,fontWeight:900,color:"#64748b",letterSpacing:".8px",margin:"0 3px 8px"}}>{isBrooklyn ? "MESSAGE INBOX" : "MESSAGE HISTORY"}</div>
        {loading ? <div style={{padding:24,textAlign:"center",color:"#64748b"}}>Loading…</div> : history.length===0 ? <div style={{background:"#162032",border:"1px solid #1e3a5f",borderRadius:14,padding:24,textAlign:"center",color:"#64748b",fontSize:12}}>No direct notes have been sent yet.</div> : history.map(item=>{const b=badge(item);return <article key={item.id} style={{background:"#162032",border:`1px solid ${item.responded_at ? "rgba(139,92,246,.3)" : "#1e3a5f"}`,borderRadius:14,padding:14,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div style={{fontSize:14,fontWeight:900}}>{item.subject}</div><span style={{fontSize:9,fontWeight:900,color:b.color,background:b.bg,border:`1px solid ${b.border}`,borderRadius:999,padding:"3px 7px"}}>{b.text}</span></div>
          <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.5,whiteSpace:"pre-wrap",marginTop:7}}>{item.message}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:9}}>Sent by {item.sender_name} · {new Date(item.created_at).toLocaleString()}</div>
          {item.read_at && <div style={{fontSize:10,color:"#6ee7b7",marginTop:5}}>✓ Read by {item.read_by || "Brooklyn"} · {new Date(item.read_at).toLocaleString()}</div>}
          {item.response && item.responded_at && <div style={{marginTop:11,background:"rgba(139,92,246,.1)",border:"1px solid rgba(139,92,246,.28)",borderRadius:10,padding:11}}><div style={{fontSize:10,fontWeight:900,color:"#c4b5fd",marginBottom:5}}>BROOKLYN REPLIED</div><div style={{fontSize:12,color:"#ede9fe",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{item.response}</div><div style={{fontSize:10,color:"#8b7fab",marginTop:7}}>{item.responded_by || "Brooklyn"} · {new Date(item.responded_at).toLocaleString()}</div></div>}
          {isBrooklyn && <div style={{marginTop:11}}><textarea value={replyDrafts[item.id] ?? item.response ?? ""} onChange={event=>setReplyDrafts(previous=>({...previous,[item.id]:event.target.value.slice(0,2000)}))} rows={3} placeholder="Type your reply…" style={{width:"100%",background:"#0f172a",border:"1px solid rgba(139,92,246,.35)",borderRadius:9,color:"#f8fafc",padding:"9px 10px",fontFamily:"inherit",fontSize:12,resize:"vertical"}}/><button onClick={()=>sendReply(item.id)} disabled={replyingId===item.id || !(replyDrafts[item.id] ?? item.response ?? "").trim()} style={{width:"100%",marginTop:7,border:0,borderRadius:9,background:"#7c3aed",color:"#fff",padding:10,fontWeight:900,opacity:replyingId===item.id || !(replyDrafts[item.id] ?? item.response ?? "").trim() ? .5 : 1}}>{replyingId===item.id ? "Posting…" : item.response ? "Update Reply" : "Reply in App"}</button></div>}
        </article>})}
      </section>
    </div>
  </main>;
}
