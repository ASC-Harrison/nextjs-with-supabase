"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAILS = ["hogstud800@gmail.com"];
const BROOKLYN_EMAIL = "brooklyncarter.0716@gmail.com";
const BROOKLYN_PIN = "2345";

type Area = {
  id: string;
  name: string;
  total: number;
  low: number;
};

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [brooklynLocked, setBrooklynLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 2), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const email = data.session.user.email ?? null;
        setUserEmail(email);
        if (email?.toLowerCase() === BROOKLYN_EMAIL.toLowerCase()) {
          const unlocked = localStorage.getItem("brooklyn_unlocked");
          if (unlocked !== "true") setBrooklynLocked(true);
        }
        setLoading(false);
        loadAreas();
        return;
      }
      const token = localStorage.getItem("asc_session_token");
      const email = localStorage.getItem("asc_user_email");
      if (token && email) {
        supabase.auth.setSession({ access_token: token, refresh_token: "" }).then(({ data: d }) => {
          if (d.session) {
            const e = d.session.user.email ?? null;
            setUserEmail(e);
            if (e?.toLowerCase() === BROOKLYN_EMAIL.toLowerCase()) {
              const unlocked = localStorage.getItem("brooklyn_unlocked");
              if (unlocked !== "true") setBrooklynLocked(true);
            }
            setLoading(false);
            loadAreas();
          } else {
            router.replace("/login");
          }
        });
        return;
      }
      router.replace("/login");
    });
  }, []);

  async function loadAreas() {
    try {
      const { data: areaData } = await supabase.from("storage_areas").select("id, name").order("name");
      if (!areaData) return;
      const { data: invData } = await supabase.from("storage_inventory_area_view").select("storage_area_id, on_hand, par_level, low_level").gt("par_level", 0);
      const areaMap: Record<string, { total: number; low: number }> = {};
      areaData.forEach(a => { areaMap[a.id] = { total: 0, low: 0 }; });
      if (invData) {
        invData.forEach((row: any) => {
          if (!areaMap[row.storage_area_id]) return;
          areaMap[row.storage_area_id].total++;
          const isLow = (row.low_level ?? 0) > 0 && (row.on_hand ?? 0) <= (row.low_level ?? 0);
          if (isLow) areaMap[row.storage_area_id].low++;
        });
      }
      setAreas(areaData.map(a => ({ id: a.id, name: a.name, total: areaMap[a.id]?.total ?? 0, low: areaMap[a.id]?.low ?? 0 })));
    } catch {}
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("asc_user_email");
    localStorage.removeItem("asc_user_name");
    localStorage.removeItem("asc_session_token");
    localStorage.removeItem("brooklyn_unlocked");
    router.push("/login");
  }

  function goToArea(areaId: string) {
    router.push(`/areas/${areaId}`);
  }

  const isAdmin = ADMIN_EMAILS.includes(userEmail?.toLowerCase() ?? "");

  if (loading) {
    return (
      <main style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#64748b", fontSize:14 }}>Loading…</div>
      </main>
    );
  }

  // Brooklyn timeout screen
  if (brooklynLocked) {
    return (
      <main style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"-apple-system,sans-serif" }}>
        <div style={{ maxWidth:400, width:"100%", background:"#162032", border:"1px solid #1e3a5f", borderRadius:20, padding:32, textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#ef4444,#f97316,#ef4444)" }} />
          <pre style={{ fontSize:48, lineHeight:1.2, marginBottom:8, fontStyle:"normal" }}>
            {frame === 0 ? `( ╹◡╹)ノ` : `ヽ(╹◡╹ )`}
          </pre>
          <div style={{ fontSize:22, fontWeight:900, color:"#f0f6ff", marginBottom:8, letterSpacing:-0.5 }}>🚨 TIME OUT 🚨</div>
          <div style={{ fontSize:14, color:"#94a3b8", lineHeight:1.8, marginBottom:24 }}>
            You are officially in time out, Brooklyn.<br />
            You must get the <strong style={{ color:"#fcd34d" }}>secret passcode</strong><br />
            from <strong style={{ color:"#60a5fa" }}>The King</strong> to proceed. 👑<br /><br />
            <span style={{ fontSize:12, color:"#64748b" }}>No passcode = no app. Them's the rules.</span>
          </div>
          <input
            value={pinInput}
            onChange={e => { setPinInput(e.target.value.replace(/\D/g,"").slice(0,4)); setPinError(false); }}
            type="password"
            inputMode="numeric"
            placeholder="Enter passcode"
            style={{ width:"100%", borderRadius:10, border:`1px solid ${pinError?"rgba(239,68,68,0.5)":"#1e3a5f"}`, background:"#111827", color:"#f0f6ff", padding:"12px 14px", fontSize:20, fontFamily:"inherit", outline:"none", textAlign:"center", letterSpacing:8, marginBottom:10, boxSizing:"border-box" }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (pinInput === BROOKLYN_PIN) { localStorage.setItem("brooklyn_unlocked","true"); setBrooklynLocked(false); }
                else setPinError(true);
              }
            }}
          />
          {pinError && <div style={{ fontSize:12, color:"#fca5a5", marginBottom:10 }}>❌ Wrong passcode. Ask The King. 👑</div>}
          <button
            onClick={() => {
              if (pinInput === BROOKLYN_PIN) { localStorage.setItem("brooklyn_unlocked","true"); setBrooklynLocked(false); }
              else setPinError(true);
            }}
            style={{ width:"100%", borderRadius:10, padding:13, fontSize:15, fontWeight:800, border:"none", background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff", fontFamily:"inherit", cursor:"pointer", marginBottom:12 }}
          >
            Submit Passcode
          </button>
          <button onClick={handleLogout} style={{ background:"none", border:"none", color:"#334155", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const btnBase: React.CSSProperties = {
    display:"block", width:"100%", borderRadius:14, padding:"13px 16px",
    fontSize:14, fontWeight:700, border:"none", cursor:"pointer",
    textAlign:"center", fontFamily:"inherit", marginBottom:8,
  };

  return (
    <main style={{ minHeight:"100vh", width:"100%", background:"#0a0f1e", color:"#fff", display:"flex", justifyContent:"center", padding:16, paddingBottom:40 }}>
      <div style={{ width:"100%", maxWidth:480 }}>
        <div style={{ borderRadius:20, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", padding:20, marginTop:16, marginBottom:16, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)" }} />
          <div style={{ fontSize:28, fontWeight:900, lineHeight:1.2, marginBottom:4 }}>Baxter ASC<br />Inventory</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:12 }}>Cabinet tracking + building totals + low stock alerts</div>
          {userEmail && (
            <div style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
              <span>Signed in as <strong>{userEmail}</strong>{isAdmin ? " 👑" : ""}</span>
              <button onClick={handleLogout} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:6, color:"#fca5a5", padding:"2px 8px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>Sign Out</button>
            </div>
          )}
        </div>

        <button onClick={() => router.push("/inventory")} style={{ ...btnBase, background:"#fff", color:"#000", fontSize:15, padding:16, borderRadius:16, marginBottom:8 }}>
          🚀 Launch App
        </button>

        <button onClick={() => router.push("/spd")} style={{ ...btnBase, background:"rgba(99,102,241,0.15)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)", marginBottom:10 }}>
          🔬 SPD Inventory View
        </button>

        {isAdmin && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <button onClick={() => router.push("/orders")} style={{ ...btnBase, background:"rgba(234,179,8,0.2)", color:"#fcd34d", border:"1px solid rgba(234,179,8,0.3)", marginBottom:0 }}>📋 Orders</button>
              <button onClick={() => router.push("/items")} style={{ ...btnBase, background:"rgba(99,102,241,0.2)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)", marginBottom:0 }}>➕ Add Items</button>
              <button onClick={() => router.push("/reports")} style={{ ...btnBase, background:"rgba(16,185,129,0.2)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.3)", marginBottom:0 }}>📊 Reports</button>
              <button onClick={() => router.push("/staff-activity")} style={{ ...btnBase, background:"rgba(59,130,246,0.2)", color:"#93c5fd", border:"1px solid rgba(59,130,246,0.3)", marginBottom:0 }}>👥 Staff</button>
              <button onClick={() => router.push("/labels")} style={{ ...btnBase, background:"rgba(168,85,247,0.2)", color:"#d8b4fe", border:"1px solid rgba(168,85,247,0.3)", marginBottom:0 }}>🏷️ Labels</button>
              <button onClick={() => router.push("/admin-users")} style={{ ...btnBase, background:"rgba(16,185,129,0.15)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.25)", marginBottom:0 }}>🔐 Users</button>
            </div>
            <button onClick={() => router.push("/admin")} style={{ ...btnBase, background:"rgba(255,255,255,0.08)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", marginBottom:16 }}>
              Admin Inventory (Table View)
            </button>
          </>
        )}

        <div style={{ fontSize:13, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10 }}>Storage Areas</div>
        {areas.length === 0 ? (
          <div style={{ fontSize:13, color:"#334155", textAlign:"center", padding:20 }}>Loading areas…</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {areas.map(area => (
              <button key={area.id} onClick={() => goToArea(area.id)} style={{ background: area.low > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${area.low > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius:12, padding:"14px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"all 0.18s" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f0f6ff", wordBreak:"break-word", lineHeight:1.3, marginBottom:6 }}>{area.name}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#64748b" }}>{area.total} items</span>
                  {area.low > 0 && <span style={{ fontSize:10, fontWeight:800, color:"#fca5a5", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:4, padding:"1px 6px" }}>{area.low} LOW</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:11, marginTop:20 }}>
          {isAdmin ? "Administrator 👑" : "Staff"} · Sessions last 8 hours
        </div>
      </div>
    </main>
  );
}
