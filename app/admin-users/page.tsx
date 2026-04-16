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
  .btn{border-radius:10px;padding:11px 18px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit;transition:all 0.18s;display:inline-flex;align-items:center;gap:6px;justify-content:center;}
  .btn-ac{background:#3b82f6;color:#fff;}
  .btn-ac:hover{background:#2563eb;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .btn-gh:hover{color:#f0f6ff;}
  .btn-warn{background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .btn-err{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .btn-full{width:100%;}
  .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:14px;}
  .ok{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;font-size:13px;color:#6ee7b7;margin-bottom:14px;}
  .current-user{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:12px 14px;font-size:12px;color:#93c5fd;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
  .sign-out-btn{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;padding:4px 12px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700;}
  .divider{height:1px;background:#1e3a5f;margin:4px 0 16px;}
  .staff-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #1e3a5f;}
  .staff-row:last-child{border-bottom:none;}
  .staff-email{font-size:13px;font-weight:600;color:#f0f6ff;word-break:break-all;}
  .staff-date{font-size:11px;color:#64748b;margin-top:2px;}
`;

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser,  setCurrentUser]  = useState<any>(null);
  const [msg,          setMsg]          = useState<{type:"ok"|"err";text:string}|null>(null);

  // Add new user
  const [newEmail,    setNewEmail]    = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName,     setNewName]     = useState("");
  const [addLoading,  setAddLoading]  = useState(false);

  // Reset someone's password
  const [resetEmail,    setResetEmail]    = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading,  setResetLoading]  = useState(false);

  // Change own password
  const [myPassword,   setMyPassword]   = useState("");
  const [myPwLoading,  setMyPwLoading]  = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  function showMsg(type: "ok"|"err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setAddLoading(true);
    try {
      const res  = await fetch("/api/admin/invite-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:newEmail.trim(), password:newPassword, name:newName.trim() }) });
      const json = await res.json();
      if (!json.ok) showMsg("err", json.error);
      else { showMsg("ok", `✅ Account created for ${newEmail}`); setNewEmail(""); setNewPassword(""); setNewName(""); }
    } catch (e: any) { showMsg("err", e?.message ?? "Failed"); }
    finally { setAddLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim() || !resetPassword.trim()) return;
    if (resetPassword.length < 6) { showMsg("err", "Password must be at least 6 characters"); return; }
    setResetLoading(true);
    try {
      const res  = await fetch("/api/admin/reset-password", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:resetEmail.trim(), password:resetPassword }) });
      const json = await res.json();
      if (!json.ok) showMsg("err", json.error);
      else { showMsg("ok", `✅ Password reset for ${resetEmail}`); setResetEmail(""); setResetPassword(""); }
    } catch (e: any) { showMsg("err", e?.message ?? "Failed"); }
    finally { setResetLoading(false); }
  }

  async function handleMyPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!myPassword.trim() || myPassword.length < 6) { showMsg("err", "Password must be at least 6 characters"); return; }
    setMyPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: myPassword });
      if (error) showMsg("err", error.message);
      else { showMsg("ok", "✅ Your password has been updated"); setMyPassword(""); }
    } catch (e: any) { showMsg("err", e?.message ?? "Failed"); }
    finally { setMyPwLoading(false); }
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
          <div className="sub">Add staff, reset passwords, manage accounts</div>

          {currentUser && (
            <div className="current-user">
              <span>Signed in as: <strong>{currentUser.email}</strong></span>
              <button onClick={handleLogout} className="sign-out-btn">Sign Out</button>
            </div>
          )}

          {msg && <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>}

          {/* Reset any staff password */}
          <div className="card">
            <div className="card-title">🔑 Reset Staff Password</div>
            <div className="card-sub">Reset the password for any staff member who is locked out</div>
            <form onSubmit={handleResetPassword}>
              <label className="label">Staff Email</label>
              <input
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                type="email"
                className="inp"
                placeholder="staff@example.com"
                required
              />
              <label className="label">New Password</label>
              <input
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                type="password"
                className="inp"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
              <button type="submit" className="btn btn-warn btn-full" disabled={resetLoading}>
                {resetLoading ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          </div>

          {/* Add new staff */}
          <div className="card">
            <div className="card-title">➕ Add New Staff Member</div>
            <div className="card-sub">They can log in immediately with these credentials</div>
            <form onSubmit={handleAddUser}>
              <label className="label">Full Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="inp" placeholder="e.g., Brooklyn Carter" />
              <label className="label">Work Email *</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" className="inp" placeholder="staff@example.com" required />
              <label className="label">Temporary Password *</label>
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="inp" placeholder="Min 6 characters" required minLength={6} />
              <button type="submit" className="btn btn-ac btn-full" disabled={addLoading}>
                {addLoading ? "Creating…" : "Create Staff Account"}
              </button>
            </form>
          </div>

          {/* Change own password */}
          <div className="card">
            <div className="card-title">🔒 Change Your Password</div>
            <div className="card-sub">Update your own login password</div>
            <form onSubmit={handleMyPassword}>
              <label className="label">New Password</label>
              <input value={myPassword} onChange={(e) => setMyPassword(e.target.value)} type="password" className="inp" placeholder="Min 6 characters" required minLength={6} />
              <button type="submit" className="btn btn-ac btn-full" disabled={myPwLoading}>
                {myPwLoading ? "Updating…" : "Update My Password"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Security Notes</div>
            <div style={{ fontSize:12, color:"#64748b", lineHeight:1.8 }}>
              • Sessions expire after <strong style={{color:"#94a3b8"}}>30 minutes</strong> of inactivity<br/>
              • All actions are logged with verified user accounts<br/>
              • To permanently remove a staff member go to Supabase → Authentication → Users<br/>
              • Each person must use their own login — no shared accounts
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
