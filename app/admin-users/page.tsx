"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:600px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .title{font-size:24px;font-weight:900;color:#f0f6ff;letter-spacing:-0.5px;margin-bottom:4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:24px;}
  .card{background:#162032;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;}
  .card-title{font-size:15px;font-weight:800;color:#f0f6ff;margin-bottom:4px;}
  .card-sub{font-size:12px;color:#64748b;margin-bottom:16px;}
  .label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;display:block;}
  .inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:11px 14px;font-size:13px;font-family:inherit;outline:none;transition:all 0.18s;margin-bottom:10px;}
  .inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
  .inp::placeholder{color:#334155;}
  .btn{border-radius:10px;padding:11px 18px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;display:inline-flex;align-items:center;gap:6px;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-ac:hover{background:#2563eb;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-gh:hover{color:#f0f6ff;}
  .btn-err{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .btn-full{width:100%;}
  .user-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #1e3a5f;}
  .user-row:last-child{border-bottom:none;}
  .user-email{font-size:13px;font-weight:600;color:#f0f6ff;word-break:break-all;}
  .user-date{font-size:11px;color:#64748b;margin-top:2px;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;}
  .badge-ok{background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:14px;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:14px;}
  .divider{height:1px;background:#1e3a5f;margin:16px 0;}
  .current-user{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:12px 14px;font-size:12px;color:#93c5fd;margin-bottom:20px;}
`;

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newEmail,    setNewEmail]    = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName,     setNewName]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState<{type:"ok"|"err";text:string}|null>(null);
  const [changePw,    setChangePw]    = useState("");
  const [changePwLoading, setChangePwLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, name: newName.trim() }),
      });
      const json = await res.json();
      if (!json.ok) { setMsg({ type:"err", text: json.error }); }
      else { setMsg({ type:"ok", text: `User ${newEmail} created successfully!` }); setNewEmail(""); setNewPassword(""); setNewName(""); }
    } catch (e: any) { setMsg({ type:"err", text: e?.message ?? "Failed" }); }
    finally { setLoading(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changePw.trim() || changePw.length < 6) { setMsg({ type:"err", text:"Password must be at least 6 characters." }); return; }
    setChangePwLoading(true); setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: changePw });
      if (error) { setMsg({ type:"err", text: error.message }); }
      else { setMsg({ type:"ok", text:"Password updated successfully!" }); setChangePw(""); }
    } catch (e: any) { setMsg({ type:"err", text: e?.message ?? "Failed" }); }
    finally { setChangePwLoading(false); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>
          <div className="title">User Management</div>
          <div className="sub">Add staff accounts and manage your own password</div>

          {currentUser && (
            <div className="current-user">
              Signed in as: <strong>{currentUser.email}</strong>
              <button onClick={handleLogout} style={{ marginLeft: 12, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, color:"#fca5a5", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>
                Sign Out
              </button>
            </div>
          )}

          {msg && <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>}

          {/* Add new staff */}
          <div className="card">
            <div className="card-title">Add New Staff Member</div>
            <div className="card-sub">They can log in immediately with these credentials</div>
            <form onSubmit={handleInvite}>
              <label className="label">Full Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="inp" placeholder="e.g., Brooklyn Carter" />
              <label className="label">Work Email *</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" className="inp" placeholder="staff@example.com" required />
              <label className="label">Temporary Password *</label>
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="inp" placeholder="Min 6 characters" required minLength={6} />
              <button type="submit" className="btn btn-ac btn-full" disabled={loading}>
                {loading ? "Creating…" : "Create Staff Account"}
              </button>
            </form>
          </div>

          {/* Change own password */}
          <div className="card">
            <div className="card-title">Change Your Password</div>
            <div className="card-sub">Update your own login password</div>
            <form onSubmit={handleChangePassword}>
              <label className="label">New Password</label>
              <input value={changePw} onChange={(e) => setChangePw(e.target.value)} type="password" className="inp" placeholder="Min 6 characters" required minLength={6} />
              <button type="submit" className="btn btn-ac btn-full" disabled={changePwLoading}>
                {changePwLoading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Security Notes</div>
            <div style={{ fontSize:12, color:"#64748b", lineHeight:1.7 }}>
              • Sessions expire after <strong style={{color:"#94a3b8"}}>30 minutes</strong> of inactivity<br/>
              • All actions are logged with the verified user account<br/>
              • To remove a staff member, go to Supabase → Authentication → Users and delete their account<br/>
              • Each person must use their own login — no shared accounts
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
