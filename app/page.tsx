"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAIL = "hogstud800@gmail.com";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      setLoading(false);
      loadAreas();
    });
  }, []);

  async function loadAreas() {
    try {
      // Get all storage areas
      const { data: areaData } = await supabase
        .from("storage_areas")
        .select("id, name")
        .order("name");

      if (!areaData) return;

      // Get inventory counts per area
      const { data: invData } = await supabase
        .from("storage_inventory_area_view")
        .select("storage_area_id, on_hand, par_level, low_level")
        .gt("par_level", 0);

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

      setAreas(areaData.map(a => ({
        id: a.id,
        name: a.name,
        total: areaMap[a.id]?.total ?? 0,
        low: areaMap[a.id]?.low ?? 0,
      })));
    } catch {}
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function goToArea(areaId: string) {
    // Store area ID and go to inventory
    localStorage.setItem("asc_area_id_v1", areaId);
    router.push("/inventory?tab=area");
  }

  const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (loading) {
    return (
      <main style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#64748b", fontSize:14 }}>Loading…</div>
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

        {/* Header */}
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

        {/* Main buttons */}
        <button onClick={() => router.push("/inventory")} style={{ ...btnBase, background:"#fff", color:"#000", fontSize:15, padding:16, borderRadius:16, marginBottom:10 }}>
          🚀 Launch App
        </button>

        {isAdmin && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <button onClick={() => router.push("/orders")} style={{ ...btnBase, background:"rgba(234,179,8,0.2)", color:"#fcd34d", border:"1px solid rgba(234,179,8,0.3)", marginBottom:0 }}>
                📋 Orders
              </button>
              <button onClick={() => router.push("/items")} style={{ ...btnBase, background:"rgba(99,102,241,0.2)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)", marginBottom:0 }}>
                ➕ Add Items
              </button>
              <button onClick={() => router.push("/reports")} style={{ ...btnBase, background:"rgba(16,185,129,0.2)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.3)", marginBottom:0 }}>
                📊 Reports
              </button>
              <button onClick={() => router.push("/staff-activity")} style={{ ...btnBase, background:"rgba(59,130,246,0.2)", color:"#93c5fd", border:"1px solid rgba(59,130,246,0.3)", marginBottom:0 }}>
                👥 Staff
              </button>
              <button onClick={() => router.push("/labels")} style={{ ...btnBase, background:"rgba(168,85,247,0.2)", color:"#d8b4fe", border:"1px solid rgba(168,85,247,0.3)", marginBottom:0 }}>
                🏷️ Labels
              </button>
              <button onClick={() => router.push("/admin-users")} style={{ ...btnBase, background:"rgba(16,185,129,0.15)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.25)", marginBottom:0 }}>
                🔐 Users
              </button>
            </div>
            <button onClick={() => router.push("/admin")} style={{ ...btnBase, background:"rgba(255,255,255,0.08)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", marginBottom:16 }}>
              Admin Inventory (Table View)
            </button>
          </>
        )}

        {/* Storage Areas */}
        <div style={{ fontSize:13, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10 }}>
          Storage Areas
        </div>
        {areas.length === 0 ? (
          <div style={{ fontSize:13, color:"#334155", textAlign:"center", padding:20 }}>Loading areas…</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {areas.map(area => (
              <button
                key={area.id}
                onClick={() => goToArea(area.id)}
                style={{
                  background: area.low > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${area.low > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius:12, padding:"14px 12px", cursor:"pointer",
                  textAlign:"left", fontFamily:"inherit", transition:"all 0.18s",
                }}
              >
                <div style={{ fontSize:13, fontWeight:700, color:"#f0f6ff", wordBreak:"break-word", lineHeight:1.3, marginBottom:6 }}>{area.name}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#64748b" }}>{area.total} items</span>
                  {area.low > 0 && (
                    <span style={{ fontSize:10, fontWeight:800, color:"#fca5a5", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:4, padding:"1px 6px" }}>
                      {area.low} LOW
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:11, marginTop:20 }}>
          {isAdmin ? "Administrator" : "Staff"} · Sessions last 8 hours
        </div>
      </div>
    </main>
  );
}
