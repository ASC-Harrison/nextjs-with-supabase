"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type SentMessage = { id:string; created_at:string; sender_name:string; subject:string; message:string; delivery_status:string };

export default function MessageBrooklynPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const authFetch = useCallback(async (url:string, options:RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Please sign in again.");
    return fetch(url, { ...options, headers:{ "Content-Type":"application/json", Authorization:`Bearer ${data.session.access_token}`, ...(options.headers || {}) } });
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await authFetch("/api/message-brooklyn");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load messages");
      setHistory(data.messages || []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function sendNote() {
    if (!subject.trim() || !message.trim() || sending) return;
    if (!confirm("Email this note directly to Brooklyn?")) return;
    setSending(true);
    setStatus("");
    try {
      const response = await authFetch("/api/message-brooklyn", { method:"POST", body:JSON.stringify({ subject, message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send note");
      setHistory(previous => [data.message, ...previous]);
      setSubject("");
      setMessage("");
      setStatus("✓ Email sent to Brooklyn.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send note");
    } finally {
      setSending(false);
    }
  }

  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 15% 0%,rgba(37,99,235,.2),transparent 35%),#080d19",color:"#f8fafc",padding:"16px 16px 70px",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <button onClick={()=>router.push("/")} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:10,color:"#94a3b8",padding:"9px 15px",fontWeight:800,cursor:"pointer",marginBottom:12}}>← Back</button>
      <section style={{background:"linear-gradient(145deg,#17233a,#101827)",border:"1px solid rgba(96,165,250,.25)",borderRadius:20,padding:20,marginBottom:14,boxShadow:"0 20px 50px rgba(0,0,0,.25)"}}>
        <div style={{fontSize:23,fontWeight:950}}>✉️ Message Brooklyn</div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:5}}>Send a direct email to Brooklyn from the ASC app</div>
        <div style={{marginTop:14,background:"rgba(37,99,235,.1)",border:"1px solid rgba(96,165,250,.22)",borderRadius:10,padding:"9px 11px",fontSize:12,color:"#93c5fd"}}>Recipient is locked to <strong>Brooklyn</strong>.</div>
      </section>

      <section style={{background:"#162032",border:"1px solid #1e3a5f",borderRadius:18,padding:18,marginBottom:14}}>
        <label style={{display:"block",fontSize:10,fontWeight:900,color:"#64748b",letterSpacing:".7px",marginBottom:6}}>SUBJECT</label>
        <input value={subject} maxLength={120} onChange={event=>setSubject(event.target.value)} placeholder="Example: Please follow up on this order" style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:10,color:"#f8fafc",padding:"12px 13px",fontSize:14,outline:"none",marginBottom:13}} />
        <label style={{display:"block",fontSize:10,fontWeight:900,color:"#64748b",letterSpacing:".7px",marginBottom:6}}>NOTE FOR BROOKLYN</label>
        <textarea value={message} maxLength={2000} onChange={event=>setMessage(event.target.value)} placeholder="Type the full note here…" rows={7} style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:10,color:"#f8fafc",padding:"12px 13px",fontSize:14,fontFamily:"inherit",lineHeight:1.5,resize:"vertical",outline:"none"}} />
        <div style={{fontSize:10,color:"#475569",textAlign:"right",marginTop:4}}>{message.length}/2000</div>
        <button disabled={sending || !subject.trim() || !message.trim()} onClick={sendNote} style={{width:"100%",marginTop:10,border:0,borderRadius:11,background:"#2563eb",color:"#fff",padding:13,fontSize:14,fontWeight:900,cursor:"pointer",opacity:sending || !subject.trim() || !message.trim() ? .5 : 1}}>{sending ? "Sending…" : "✉️ Send Email to Brooklyn"}</button>
        {status && <div style={{marginTop:10,borderRadius:9,padding:"9px 11px",fontSize:12,color:status.startsWith("✓") ? "#6ee7b7" : "#fca5a5",background:status.startsWith("✓") ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)"}}>{status}</div>}
      </section>

      <section>
        <div style={{fontSize:11,fontWeight:900,color:"#64748b",letterSpacing:".8px",margin:"0 3px 8px"}}>SENT MESSAGE HISTORY</div>
        {loading ? <div style={{padding:24,textAlign:"center",color:"#64748b"}}>Loading…</div> : history.length === 0 ? <div style={{background:"#162032",border:"1px solid #1e3a5f",borderRadius:14,padding:24,textAlign:"center",color:"#64748b",fontSize:12}}>No direct notes have been sent yet.</div> : history.map(item=><article key={item.id} style={{background:"#162032",border:"1px solid #1e3a5f",borderRadius:14,padding:14,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div style={{fontSize:14,fontWeight:900}}>{item.subject}</div>
            <span style={{fontSize:9,fontWeight:900,color:"#6ee7b7",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:999,padding:"3px 7px"}}>{item.delivery_status}</span>
          </div>
          <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.5,whiteSpace:"pre-wrap",marginTop:7}}>{item.message}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:9}}>{item.sender_name} · {new Date(item.created_at).toLocaleString()}</div>
        </article>)}
      </section>
    </div>
  </main>;
}
