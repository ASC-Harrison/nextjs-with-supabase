"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;display:flex;align-items:center;justify-content:center;padding:16px;}
  .card{width:100%;max-width:400px;background:#162032;border:1px solid #1e3a5f;border-radius:20px;padding:32px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);border-radius:20px 20px 0 0;}
  .logo{width:48px;height:48px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px;box-shadow:0 0 24px rgba(59,130,246,0.3);}
  .title{font-size:24px;font-weight:900;color:#f0f6ff;letter-spacing:-0.5px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:28px;}
  .label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:12px 14px;font-size:14px;font-family:inherit;outline:none;transition:all 0.18s;margin-bottom:14px;}
  .inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
  .inp::placeholder{color:#334155;}
  .btn{width:100%;border-radius:10px;padding:13px;font-size:15px;font-weight:800;cursor:pointer;border:none;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;font-family:inherit;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(59,130,246,0.3);transition:all 0.18s;margin-top:4px;}
  .btn:hover:not(:disabled){box-shadow:0 6px 28px rgba(59,130,246,0.45);transform:translateY(-1px);}
  .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px 14px;font-size:13px;color:#fca5a5;margin-bottom:14px;}
  .timeout-badge{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:#fcd34d;margin-bottom:16px;}
`;

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const isTimeout = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("timeout") === "1";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Invalid email or password");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="card">
          <div className="logo">⚕️</div>
          <div className="title">Baxter ASC</div>
          <div className="sub">Sign in to access the inventory system</div>

          {isTimeout && (
            <div className="timeout-badge">
              ⏱ Session expired due to inactivity. Please sign in again.
            </div>
          )}

          {error && <div className="err">{error}</div>}

          <form onSubmit={handleLogin}>
            <label className="label">Work Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="inp"
              autoComplete="email"
              required
            />
            <label className="label">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="inp"
              autoComplete="current-password"
              required
            />
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop:20, fontSize:12, color:"#334155", textAlign:"center", lineHeight:1.6 }}>
            Contact your administrator to get access.<br/>
            Sessions expire after 30 minutes of inactivity.
          </div>
        </div>
      </div>
    </>
  );
}
