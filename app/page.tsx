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
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (loading) {
    return (
      <main style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#64748b", fontSize:14 }}>Loading…</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight:"100vh", width:"100%", background:"#000", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ width:"100%", maxWidth:400, borderRadius:24, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", padding:24 }}>

        <div style={{ fontSize:36, fontWeight:900, lineHeight:1.2 }}>
          Baxter ASC<br />Inventory
        </div>
        <div style={{ marginTop:8, color:"rgba(255,255,255,0.5)", fontSize:13 }}>
          Cabinet tracking + building totals + low stock alerts
        </div>

        {userEmail && (
          <div style={{ marginTop:16, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <span>Signed in as <strong>{userEmail}</strong>{isAdmin ? " 👑" : ""}</span>
            <button onClick={handleLogout} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, color:"#fca5a5", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>
              Sign Out
            </button>
          </div>
        )}

        <div style={{ marginTop:24, display:"flex", flexDirection:"column", gap:12 }}>

          {/* Everyone sees this */}
          <button
            onClick={() => router.push("/inventory")}
            style={{ width:"100%", borderRadius:16, background:"#fff", color:"#000", fontWeight:700, padding:16, fontSize:15, border:"none", cursor:"pointer", textAlign:"center" }}
          >
            Launch App
          </button>

          {/* Admin only */}
          {isAdmin && (
            <>
              <button
                onClick={() => router.push("/admin")}
                style={{ width:"100%", borderRadius:16, background:"rgba(255,255,255,0.1)", color:"#fff", fontWeight:700, padding:16, fontSize:15, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer", textAlign:"center" }}
              >
                Admin Inventory (Table View)
              </button>

              <button
                onClick={() => router.push("/staff-activity")}
                style={{ width:"100%", borderRadius:16, background:"rgba(59,130,246,0.15)", color:"#93c5fd", fontWeight:700, padding:16, fontSize:15, border:"1px solid rgba(59,130,246,0.25)", cursor:"pointer", textAlign:"center" }}
              >
                👥 Staff Activity
              </button>

              <button
                onClick={() => router.push("/admin-users")}
                style={{ width:"100%", borderRadius:16, background:"rgba(16,185,129,0.15)", color:"#6ee7b7", fontWeight:700, padding:16, fontSize:15, border:"1px solid rgba(16,185,129,0.25)", cursor:"pointer", textAlign:"center" }}
              >
                🔐 User Management
              </button>
            </>
          )}

        </div>

        <div style={{ marginTop:20, textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:12 }}>
          Tip: Add this page to your Home Screen for quick access.
        </div>
      </div>
    </main>
  );
}
