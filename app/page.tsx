"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAILS = ["hogstud800@gmail.com", "brooklyncarter.0716@gmail.com"];
const PREOP_ONLY_EMAILS = ["andrea.burris88@icloud.com"];

type Area = { id: string; name: string; total: number; low: number; };


type DashboardIconName = "inventory" | "chat" | "scan" | "orders";

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "inventory") return <svg {...common}><rect x="3.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="3.5" y="14" width="7" height="6" rx="1.5"/><rect x="13.5" y="14" width="7" height="6" rx="1.5"/></svg>;
  if (name === "chat") return <svg {...common}><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5.2 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>;
  if (name === "scan") return <svg {...common}><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M7 12h10"/></svg>;
  return <svg {...common}><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>;
}

const SKEL_CSS = `
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.skel{animation:pulse 1.5s ease-in-out infinite}
.dashboard-card,.dashboard-mini-card,.area-card{transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease,background .2s ease}
.dashboard-icon{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;margin-bottom:13px;color:#bfdbfe;background:linear-gradient(145deg,rgba(59,130,246,.2),rgba(6,182,212,.08));border:1px solid rgba(96,165,250,.18);box-shadow:inset 0 1px rgba(255,255,255,.04)}
.dashboard-card-primary .dashboard-icon{color:#fff;background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.18)}
.live-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.09),0 0 14px rgba(52,211,153,.55)}
@media(hover:hover){.dashboard-card:hover,.area-card:hover{transform:translateY(-3px);border-color:rgba(96,165,250,.3)!important;box-shadow:0 22px 48px rgba(0,0,0,.25)!important}.dashboard-mini-card:hover{transform:translateY(-2px);border-color:rgba(96,165,250,.24)!important}}
`;

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    async function syncExistingPushSubscription() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        let sub = await reg.pushManager.getSubscription();

        // A browser can retain notification permission after its push
        // subscription is lost. Repair that state without asking the user
        // to disable and re-enable notifications.
        if (!sub && Notification.permission === "granted") {
          const VAPID_PUBLIC = "BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";
          const padding = "=".repeat((4 - (VAPID_PUBLIC.length % 4)) % 4);
          const base64 = (VAPID_PUBLIC + padding).replace(/-/g, "+").replace(/_/g, "/");
          const applicationServerKey = Uint8Array.from(
            [...atob(base64)].map(character => character.charCodeAt(0)),
          );
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        if (!sub) return;

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;

        const response = await fetch("/api/push-subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + sessionData.session.access_token,
          },
          body: JSON.stringify({
            subscription: sub,
            staff_name: localStorage.getItem("asc_user_email"),
          }),
        });
        if (!response.ok) throw new Error(`Push subscription sync failed (${response.status})`);
        if (!cancelled) setPushEnabled(true);
      } catch (error) {
        console.error("Failed to sync existing push subscription:", error);
      }
    }

    void syncExistingPushSubscription();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ping = () => supabase.from("storage_areas").select("id").limit(1).then(() => {});
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUserEmail(data.session.user.email ?? null);
        localStorage.removeItem("asc_readonly");
        setLoading(false);
        loadAreas();
        return;
      }
      const token = localStorage.getItem("asc_session_token");
      const email = localStorage.getItem("asc_user_email");
      if (token && email) {
        supabase.auth.setSession({ access_token: token, refresh_token: "" }).then(({ data: d }) => {
          if (d.session) {
            setUserEmail(d.session.user.email ?? null);
            setLoading(false);
            loadAreas();
          } else {
            localStorage.removeItem("asc_session_token");
            localStorage.removeItem("asc_user_email");
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
      const [areaRes, invRes] = await Promise.all([
        supabase.from("storage_areas").select("id, name").order("name"),
        supabase.from("storage_inventory_area_view").select("storage_area_id, on_hand, low_level").gt("par_level", 0)
      ]);
      const areaData = areaRes.data;
      const invData = invRes.data;
      if (!areaData) return;
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
    router.push("/login");
  }

  const isAdmin = ADMIN_EMAILS.includes(userEmail?.toLowerCase() ?? "");
  const isPreOpOnly = PREOP_ONLY_EMAILS.includes(userEmail?.toLowerCase() ?? "");

  if (loading) {
    return (
      <main style={{ minHeight:"100vh", width:"100%", background:"#0a0f1e", display:"flex", justifyContent:"center", padding:16 }}>
        <style dangerouslySetInnerHTML={{ __html: SKEL_CSS }} />
        <div style={{ width:"100%", maxWidth:480, marginTop:16 }}>
          <div style={{ borderRadius:20, background:"#162032", border:"1px solid #1e3a5f", padding:20, marginBottom:16 }}>
            <div className="skel" style={{ height:32, width:"60%", background:"#1e2d42", borderRadius:8, marginBottom:8 }} />
            <div className="skel" style={{ height:14, width:"80%", background:"#1e2d42", borderRadius:6, marginBottom:12 }} />
            <div className="skel" style={{ height:36, background:"#1e2d42", borderRadius:8 }} />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="skel" style={{ height:52, background:"#162032", border:"1px solid #1e3a5f", borderRadius:14, marginBottom:8 }} />
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:16 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="skel" style={{ height:72, background:"#162032", border:"1px solid #1e3a5f", borderRadius:12 }} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  async function enablePush() {
    setPushLoading(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        alert("Push notifications aren't supported on this browser/device.");
        setPushLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notifications were blocked. Enable them in your browser/phone settings to get restock alerts.");
        setPushLoading(false);
        return;
      }
      const VAPID_PUBLIC = "BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";
      function urlBase64ToUint8Array(base64String: string) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/push-subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionData.session.access_token,
        },
        body: JSON.stringify({ subscription: sub, staff_name: userEmail }),
      });
      if (!response.ok) throw new Error("Could not register this phone.");
      setPushEnabled(true);
    } catch (e: any) {
      alert("Failed to enable notifications: " + (e?.message ?? "unknown error"));
    }
    setPushLoading(false);
  }

  const btnBase: React.CSSProperties = {
    display:"block", width:"100%", borderRadius:14, padding:"13px 16px",
    fontSize:14, fontWeight:700, border:"none", cursor:"pointer",
    textAlign:"center", fontFamily:"inherit", marginBottom:8,
  };

  if (isPreOpOnly) {
    return (
      <main style={{ minHeight:"100vh", width:"100%", background:"#0a0f1e", color:"#fff", display:"flex", justifyContent:"center", padding:16, paddingBottom:40 }}>
        <div style={{ width:"100%", maxWidth:480, marginTop:16 }}>
          <div style={{ borderRadius:20, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", padding:20, marginBottom:16, position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)" }} />
            <div style={{ fontSize:24, fontWeight:900, marginBottom:4 }}>ASC Inventory</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:12 }}>Pre-Op / PACU Staff Portal</div>
            {userEmail && (
              <div style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>Signed in as <strong>{userEmail}</strong></span>
                <button onClick={handleLogout} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:6, color:"#fca5a5", padding:"2px 8px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>Sign Out</button>
              </div>
            )}
          </div>

          <button onClick={() => router.push("/preop")} style={{ display:"block", width:"100%", borderRadius:14, padding:16, fontSize:15, fontWeight:700, border:"1px solid rgba(20,184,166,0.3)", cursor:"pointer", textAlign:"center", fontFamily:"inherit", background:"rgba(20,184,166,0.2)", color:"#5eead4", marginBottom:8 }}>
            🏥 Pre-Op / PACU Inventory
          </button>

          <button onClick={() => router.push("/preop-testing")} style={{ display:"block", width:"100%", borderRadius:14, padding:16, fontSize:15, fontWeight:700, border:"1px solid rgba(14,165,233,0.3)", cursor:"pointer", textAlign:"center", fontFamily:"inherit", background:"rgba(14,165,233,0.2)", color:"#7dd3fc", marginBottom:16 }}>
            🧪 Pre-Op Testing
          </button>

          <button onClick={() => router.push("/chat")} style={{ display:"block", width:"100%", borderRadius:14, padding:16, fontSize:15, fontWeight:700, border:"1px solid rgba(59,130,246,0.3)", cursor:"pointer", textAlign:"center", fontFamily:"inherit", background:"rgba(59,130,246,0.18)", color:"#93c5fd", marginBottom:16 }}>
            💬 Staff Chat
          </button>

          <div style={{ background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>Questions or issues?</div>
            <div style={{ fontSize:12, color:"#93c5fd", fontWeight:600 }}>Contact Brooklyn — M–F 7am to 4pm CST</div>
            <a href="mailto:brooklyncarter.0716@gmail.com" style={{ fontSize:12, color:"#3b82f6", textDecoration:"none", fontWeight:700 }}>brooklyncarter.0716@gmail.com</a>
          </div>
        </div>
      </main>
    );
  }

  const totalTracked = areas.reduce((sum, area) => sum + area.total, 0);
  const totalLow = areas.reduce((sum, area) => sum + area.low, 0);

  const card: React.CSSProperties = {
    borderRadius:18,
    border:"1px solid rgba(148,163,184,.14)",
    background:"linear-gradient(145deg,rgba(30,41,59,.88),rgba(15,23,42,.9))",
    color:"#f8fafc",
    padding:16,
    cursor:"pointer",
    textAlign:"left",
    fontFamily:"inherit",
    boxShadow:"0 16px 38px rgba(0,0,0,.16)",
    minHeight:112,
  };

  return (
    <main style={{
      minHeight:"100vh",width:"100%",color:"#fff",display:"flex",justifyContent:"center",
      padding:"16px 16px 40px",
      background:"radial-gradient(circle at 15% 0%,rgba(37,99,235,.18),transparent 34%),radial-gradient(circle at 100% 22%,rgba(14,165,233,.08),transparent 28%),#080d19"
    }}>
      <style dangerouslySetInnerHTML={{ __html: SKEL_CSS }} />
      <div style={{ width:"100%", maxWidth:980 }}>
        <header style={{
          borderRadius:24,background:"linear-gradient(145deg,rgba(30,41,59,.96),rgba(15,23,42,.96))",
          border:"1px solid rgba(96,165,250,.2)",padding:20,marginTop:6,marginBottom:14,
          boxShadow:"0 24px 60px rgba(0,0,0,.25)",position:"relative",overflow:"hidden"
        }}>
          <div style={{position:"absolute",inset:"0 0 auto",height:3,background:"linear-gradient(90deg,#2563eb,#0ea5e9,#14b8a6)"}} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:13}}>
              <div style={{
                width:52,height:52,borderRadius:16,display:"grid",placeItems:"center",
                background:"linear-gradient(145deg,#2563eb,#0ea5e9)",boxShadow:"0 12px 24px rgba(37,99,235,.28)",
                fontSize:18,fontWeight:950,letterSpacing:"-.5px"
              }}>ASC</div>
              <div>
                <div style={{fontSize:27,fontWeight:950,letterSpacing:"-.8px",lineHeight:1.05}}>Inventory Hub</div>
                <div style={{color:"#94a3b8",fontSize:12,marginTop:5}}>Building supplies, orders, alerts, and staff tools</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(16,185,129,.07)",border:"1px solid rgba(52,211,153,.15)",borderRadius:999,padding:"7px 11px",fontSize:10,color:"#6ee7b7",fontWeight:850,letterSpacing:".3px"}}>
              <span className="live-dot" /> LIVE SYNC
            </div>
            {userEmail && (
              <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(15,23,42,.72)",border:"1px solid rgba(148,163,184,.16)",borderRadius:12,padding:"8px 9px 8px 12px"}}>
                <span style={{fontSize:11,color:"#94a3b8",maxWidth:230,overflow:"hidden",textOverflow:"ellipsis"}}>{userEmail}{isAdmin ? " · Admin" : " · Staff"}</span>
                <button onClick={handleLogout} style={{background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.22)",borderRadius:8,color:"#fca5a5",padding:"5px 9px",cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:800}}>Sign Out</button>
              </div>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:18}}>
            {[
              {label:"Storage Areas",value:areas.length,color:"#93c5fd"},
              {label:"Tracked Placements",value:totalTracked,color:"#c4b5fd"},
              {label:"Need Attention",value:totalLow,color:totalLow > 0 ? "#fca5a5" : "#6ee7b7"},
            ].map(stat => (
              <div key={stat.label} style={{background:"rgba(2,6,23,.42)",border:"1px solid rgba(148,163,184,.12)",borderRadius:13,padding:"11px 12px"}}>
                <div style={{fontSize:21,fontWeight:950,color:stat.color,lineHeight:1}}>{stat.value}</div>
                <div style={{fontSize:9,color:"#64748b",fontWeight:800,textTransform:"uppercase",letterSpacing:".5px",marginTop:5}}>{stat.label}</div>
              </div>
            ))}
          </div>
        </header>

        <section style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:900,color:"#64748b",textTransform:"uppercase",letterSpacing:"1px",margin:"0 3px 9px"}}>Daily Work</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
            <button className="dashboard-card dashboard-card-primary" onClick={() => router.push("/inventory")} style={{...card,background:"linear-gradient(145deg,#1d4ed8,#2563eb)",border:"1px solid rgba(147,197,253,.35)"}}>
              <div className="dashboard-icon"><DashboardIcon name="inventory" /></div>
              <div style={{fontSize:16,fontWeight:900}}>Open Inventory</div>
              <div style={{fontSize:11,color:"#bfdbfe",marginTop:4}}>View and adjust building totals</div>
            </button>
            <button className="dashboard-card" onClick={() => router.push("/chat")} style={card}>
              <div className="dashboard-icon"><DashboardIcon name="chat" /></div>
              <div style={{fontSize:16,fontWeight:900}}>Staff Chat</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Message the team in real time</div>
            </button>
            <button className="dashboard-card" onClick={() => router.push("/scan-item")} style={card}>
              <div className="dashboard-icon"><DashboardIcon name="scan" /></div>
              <div style={{fontSize:16,fontWeight:900}}>Scan Item</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Find supplies by reference number</div>
            </button>
            {isAdmin && (
              <button className="dashboard-card" onClick={() => router.push("/orders")} style={card}>
                <div className="dashboard-icon"><DashboardIcon name="orders" /></div>
                <div style={{fontSize:16,fontWeight:900}}>Orders & Receiving</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Track orders and receive deliveries</div>
              </button>
            )}
          </div>
        </section>

        <section style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:900,color:"#64748b",textTransform:"uppercase",letterSpacing:"1px",margin:"0 3px 9px"}}>Clinical Areas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
            {[
              {label:"SPD Inventory",icon:"🔬",href:"/spd",color:"#a5b4fc"},
              {label:"Pre-Op / PACU",icon:"🏥",href:"/preop",color:"#5eead4"},
              {label:"Pre-Op Testing",icon:"🧪",href:"/preop-testing",color:"#7dd3fc"},
            ].map(link => (
              <button className="dashboard-mini-card" key={link.href} onClick={() => router.push(link.href)} style={{
                ...btnBase,marginBottom:0,padding:14,background:"rgba(30,41,59,.72)",
                color:link.color,border:"1px solid rgba(148,163,184,.14)",borderRadius:14
              }}>{link.icon} {link.label}</button>
            ))}
          </div>
        </section>

        <section style={{marginBottom:16}}>
          {!pushEnabled ? (
            <button onClick={enablePush} disabled={pushLoading} style={{
              ...btnBase,marginBottom:0,background:"rgba(245,158,11,.1)",color:"#fcd34d",
              border:"1px solid rgba(245,158,11,.25)",borderRadius:14
            }}>
              {pushLoading ? "Enabling notifications…" : "🔔 Enable Alerts on This Phone"}
            </button>
          ) : (
            <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",borderRadius:14,padding:"12px 14px",fontSize:12,color:"#6ee7b7",textAlign:"center",fontWeight:800}}>
              🔔 Restock and staff-chat alerts are on for this phone
            </div>
          )}
        </section>

        {isAdmin && (
          <section style={{marginBottom:18,background:"rgba(15,23,42,.55)",border:"1px solid rgba(148,163,184,.12)",borderRadius:18,padding:13}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 2px 10px"}}>
              <div style={{fontSize:11,fontWeight:900,color:"#64748b",textTransform:"uppercase",letterSpacing:"1px"}}>Admin Workspace</div>
              <div style={{fontSize:10,color:"#475569"}}>Protected tools</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7}}>
              {[
                ["📜","Order History","/order-history"],
                ["🔄","Restock Requests","/restock-requests"],
                ["🔢","Recount Needed","/recount"],
                ["📦","Box Notes","/box-notes"],
                ["➕","Add Items","/items"],
                ["📊","Reports","/reports"],
                ["💰","Pricing Center","/price-editor"],
                ["👥","Staff Activity","/staff-activity"],
                ["🏷️","Labels","/labels"],
                ["🔐","Users","/admin-users"],
                ["📋","Admin Table","/admin"],
                ["🩺","Preference Cards","/pref-cards"],
              ].map(([icon,label,href]) => (
                <button className="dashboard-mini-card" key={href} onClick={() => router.push(href)} style={{
                  ...btnBase,marginBottom:0,padding:"11px 10px",fontSize:12,
                  background:"rgba(30,41,59,.66)",color:"#cbd5e1",
                  border:"1px solid rgba(148,163,184,.12)",borderRadius:11
                }}>{icon} {label}</button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"0 3px 9px"}}>
            <div style={{fontSize:11,fontWeight:900,color:"#64748b",textTransform:"uppercase",letterSpacing:"1px"}}>Storage Areas</div>
            <div style={{fontSize:10,color:"#475569"}}>{areas.length} areas</div>
          </div>
          {areas.length === 0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="skel" style={{height:80,background:"#162032",border:"1px solid #1e3a5f",borderRadius:14}} />)}
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
              {areas.map(area => (
                <button className="area-card" key={area.id} onClick={() => router.push(`/areas/${area.id}`)} style={{
                  background:area.low > 0 ? "linear-gradient(145deg,rgba(127,29,29,.22),rgba(30,41,59,.76))" : "rgba(30,41,59,.64)",
                  border:`1px solid ${area.low > 0 ? "rgba(248,113,113,.28)" : "rgba(148,163,184,.12)"}`,
                  borderRadius:14,padding:"13px 12px",cursor:"pointer",textAlign:"left",fontFamily:"inherit",minHeight:78
                }}>
                  <div style={{fontSize:13,fontWeight:850,color:"#f1f5f9",lineHeight:1.25,marginBottom:9}}>{area.name}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:750,color:"#64748b"}}>{area.total} placements</span>
                    {area.low > 0 ? (
                      <span style={{fontSize:9,fontWeight:900,color:"#fca5a5",background:"rgba(239,68,68,.13)",border:"1px solid rgba(239,68,68,.24)",borderRadius:999,padding:"3px 7px"}}>{area.low} LOW</span>
                    ) : (
                      <span style={{fontSize:9,fontWeight:900,color:"#6ee7b7"}}>READY</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div style={{background:"rgba(59,130,246,.05)",border:"1px solid rgba(59,130,246,.12)",borderRadius:13,padding:"12px 16px",marginTop:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"#64748b"}}>Need help? Contact Brooklyn · M–F 7am–4pm CST</div>
          <a href="mailto:brooklyncarter.0716@gmail.com" style={{fontSize:11,color:"#60a5fa",textDecoration:"none",fontWeight:800}}>brooklyncarter.0716@gmail.com</a>
        </div>
      </div>
    </main>
  );
}
