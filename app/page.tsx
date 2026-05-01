"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAIL = "hogstud800@gmail.com";

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("asc_user_email");
    localStorage.removeItem("asc_user_name");
    router.push("/login");
  }

  const isAdmin = true; // Login deactivated — show all buttons

  if (loading) {
    return (
      <main style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#64748b", fontSize:14 }}>Loading…</div>
      </main>
    );
  }

  const btnBase: React.CSSProperties = {
    display:"block", width:"100%", borderRadius:16, padding:16,
    fontSize:15, fontWeight:700, border:"none", cursor:"pointer",
    textAlign:"center", fontFamily:"inherit", marginBottom:10,
  };

  return (
    <main style={{ minHeight:"100vh", width:"100%", background:"#000", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:420, borderRadius:24, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", padding:24 }}>
        <div style={{ fontSize:36, fontWeight:900, lineHeight:1.2, marginBottom:8 }}>Baxter ASC<br />Inventory</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:13, marginBottom:16 }}>Cabinet tracking + building totals + low stock alerts</div>

        <div style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          <span>Signed in as <strong>{userEmail}</strong>{isAdmin ? " 👑" : ""}</span>
          <button onClick={handleLogout} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, color:"#fca5a5", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>Sign Out</button>
        </div>

        <button onClick={() => router.push("/inventory")} style={{ ...btnBase, background:"#fff", color:"#000" }}>
          Launch App
        </button>

        {isAdmin && (
          <>
            <button onClick={() => router.push("/orders")} style={{ ...btnBase, background:"rgba(234,179,8,0.2)", color:"#fcd34d", border:"1px solid rgba(234,179,8,0.3)" }}>
              📋 Order Management
            </button>
            <button onClick={() => router.push("/items")} style={{ ...btnBase, background:"rgba(99,102,241,0.2)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)" }}>
              ➕ Add / Manage Items
            </button>
            <button onClick={() => router.push("/reports")} style={{ ...btnBase, background:"rgba(16,185,129,0.2)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.3)" }}>
              📊 Usage Reports
            </button>
            <button onClick={() => router.push("/staff-activity")} style={{ ...btnBase, background:"rgba(59,130,246,0.2)", color:"#93c5fd", border:"1px solid rgba(59,130,246,0.3)" }}>
              👥 Staff Activity
            </button>
            <button onClick={() => router.push("/labels")} style={{ ...btnBase, background:"rgba(168,85,247,0.2)", color:"#d8b4fe", border:"1px solid rgba(168,85,247,0.3)" }}>
              🏷️ Print QR Labels
            </button>
            <button onClick={() => router.push("/admin")} style={{ ...btnBase, background:"rgba(255,255,255,0.1)", color:"#fff", border:"1px solid rgba(255,255,255,0.15)" }}>
              Admin Inventory (Table View)
            </button>
            <button onClick={() => router.push("/admin-users")} style={{ ...btnBase, background:"rgba(16,185,129,0.15)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.25)" }}>
              🔐 User Management
            </button>
          </>
        )}

        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:12, marginTop:8 }}>
          {isAdmin ? "Administrator Access" : "Staff Access"} · Sessions expire after 30 min
        </div>
      </div>
    </main>
  );
}
