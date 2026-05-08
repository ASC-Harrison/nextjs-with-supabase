"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isTimeout = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("timeout") === "1";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      // Store session manually for PWA compatibility
      localStorage.setItem("asc_user_email", data.user.email ?? "");
      localStorage.setItem("asc_user_name", data.user.user_metadata?.full_name || data.user.email || "");
      localStorage.setItem("asc_session_token", data.session.access_token);
      // Small delay to ensure session is saved before redirect
      await new Promise(r => setTimeout(r, 500));
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:400, background:"#162032", border:"1px solid #1e3a5f", borderRadius:20, padding:32, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)" }} />
        <div style={{ width:48, height:48, background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:16 }}>⚕️</div>
        <div style={{ fontSize:24, fontWeight:900, color:"#f0f6ff", letterSpacing:-0.5, marginBottom:4 }}>Baxter ASC</div>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:28 }}>Sign in to access the inventory system</div>

        {isTimeout && (
          <div style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#fcd34d", marginBottom:16 }}>
            ⏱ Session expired. Please sign in again.
          </div>
        )}

        {error && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#fca5a5", marginBottom:14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Work Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required autoComplete="email"
            style={{ width:"100%", borderRadius:10, border:"1px solid #1e3a5f", background:"#111827", color:"#f0f6ff", padding:"12px 14px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:14, boxSizing:"border-box" }} />
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Password</div>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" required autoComplete="current-password"
            style={{ width:"100%", borderRadius:10, border:"1px solid #1e3a5f", background:"#111827", color:"#f0f6ff", padding:"12px 14px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:20, boxSizing:"border-box" }} />
          <button type="submit" disabled={loading}
            style={{ width:"100%", borderRadius:10, padding:13, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", border:"none", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontFamily:"inherit", opacity:loading?0.6:1 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop:20, fontSize:12, color:"#334155", textAlign:"center", lineHeight:1.6 }}>
          Contact your administrator to get access.<br />
          Sessions expire after 30 minutes of inactivity.
        </div>
      </div>
    </div>
  );
}
