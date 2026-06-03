"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_EMAILS = ["hogstud800@gmail.com", "brooklyncarter.0716@gmail.com"];

type Area = { id: string; name: string; total: number; low: number; };

const SKEL_CSS = `@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}.skel{animation:pulse 1.5s ease-in-out infinite}`;

export default function Home() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(false);
  const [splashStarted, setSplashStarted] = useState(false);
  const [splashContent, setSplashContent] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);

  // Keepalive ping every 4 minutes to prevent Supabase cold starts
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
        // Show splash only once per session
        const splashShown = sessionStorage.getItem("asc_splash_shown");
        if (!splashShown) {
          setShowSplash(true);
        } else {
          setLoading(false);
          loadAreas();
        }
        return;
      }
      const token = localStorage.getItem("asc_session_token");
      const email = localStorage.getItem("asc_user_email");
      if (token && email) {
        supabase.auth.setSession({ access_token: token, refresh_token: "" }).then(({ data: d }) => {
          if (d.session) {
            setUserEmail(d.session.user.email ?? null);
            const splashShown = sessionStorage.getItem("asc_splash_shown");
            if (!splashShown) {
              setShowSplash(true);
            } else {
              setLoading(false);
              loadAreas();
            }
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

  function playSound() {
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      function note(freq: number, start: number, dur: number, vol?: number) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "square"; o.frequency.value = freq;
        const t = ctx.currentTime + start;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol || 0.10, t + 0.02);
        g.gain.linearRampToValueAtTime(vol || 0.10, t + dur - 0.05);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.start(t); o.stop(t + dur + 0.05);
      }
      function scheduleLoop(offset: number) {
        const t = 0.22;
        note(392,offset+0,t*0.9);note(392,offset+t,t*0.9);note(392,offset+t*2,t*0.9);
        note(311,offset+t*3,t*2.5,0.12);note(466,offset+t*3+t*2.5,t*0.6);
        note(392,offset+t*3+t*3.1,t*2.5,0.12);note(311,offset+t*3+t*5.6,t*2.0,0.10);
        note(466,offset+t*3+t*7.6,t*0.6);note(392,offset+t*3+t*8.2,t*3.5,0.12);
        const s = offset+t*3+t*11.7;
        note(587,s,t*0.9);note(587,s+t,t*0.9);note(587,s+t*2,t*0.9);
        note(622,s+t*3,t*2.5,0.12);note(466,s+t*5.5,t*0.6);
        note(370,s+t*6.1,t*2.5,0.12);note(311,s+t*8.6,t*2.0,0.10);
        note(466,s+t*10.6,t*0.6);note(392,s+t*11.2,t*3.5,0.12);
      }
      const loopEvery = 9.5;
      const loops = Math.ceil(62 / loopEvery) + 1;
      for (let i = 0; i < loops; i++) scheduleLoop(i * loopEvery);
    } catch {}
  }

  function startSplash() {
    setSplashStarted(true);
    playSound();
    setTimeout(() => setSplashContent(true), 100);
    setTimeout(() => {
      sessionStorage.setItem("asc_splash_shown", "1");
      setShowSplash(false);
      setLoading(false);
      loadAreas();
    }, 62000);
  }

  const SPLASH_CSS = `
    @keyframes twinkle{from{opacity:0.05}to{opacity:0.6}}
    @keyframes beam{0%,100%{opacity:0.02}50%{opacity:0.07}}
    @keyframes scrollUp{from{top:100%}to{top:-420%}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(0.3)}to{opacity:1;transform:scale(1)}}
    @keyframes expandLine{from{width:0}to{width:80%}}
    .star{position:absolute;border-radius:50%;background:#fff;animation:twinkle var(--dur) var(--delay) infinite alternate;}
    .fu1{animation:fadeUp 0.8s 0.8s both}.fu2{animation:fadeUp 0.8s 1.4s both}.fu3{animation:fadeUp 0.8s 2.1s both}.fu4{animation:fadeUp 0.8s 3.8s both}
    .si{animation:scaleIn 0.9s 0.2s both}.el{animation:expandLine 1.8s 2.8s both}
  `;

  if (showSplash) {
    const stars = Array.from({length:80}).map((_,i) => ({
      w: Math.random()*2.5+0.5, l: Math.random()*100, t: Math.random()*100,
      dur: Math.random()*4+2, delay: Math.random()*3, id: i
    }));
    return (
      <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", padding:24, overflow:"hidden", position:"relative" }}>
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        {stars.map(s => (
          <div key={s.id} className="star" style={{ width:s.w, height:s.w, left:`${s.l}%`, top:`${s.t}%`, ["--dur" as any]:`${s.dur}s`, ["--delay" as any]:`${s.delay}s` } as any} />
        ))}
        {splashStarted && Array.from({length:6}).map((_,i) => (
          <div key={i} className="beam" style={{ transform:`rotate(${i*30}deg)`, ["--dur" as any]:`${2+i*0.3}s` } as any} />
        ))}
        {!splashStarted ? (
          <div onClick={startSplash} style={{ position:"relative", zIndex:10, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⚕️</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#fcd34d", letterSpacing:2, marginBottom:8 }}>A LONG TIME AGO</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:24 }}>in a surgical center far, far away...</div>
            <button onClick={startSplash} style={{ background:"linear-gradient(135deg,#fcd34d,#f59e0b)", border:"none", color:"#0a0f1e", fontSize:15, fontWeight:900, padding:"16px 32px", borderRadius:50, cursor:"pointer", fontFamily:"inherit", letterSpacing:1 }}>
              🎵 TAP TO BEGIN
            </button>
          </div>
        ) : splashContent ? (
          <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
            <div id="crawl-text" style={{ position:"absolute", left:0, right:0, top:"100%", padding:"0 32px", textAlign:"center", animation:`scrollUp 60s linear 2s forwards` }}>
              <div style={{ color:"#fcd34d", lineHeight:2.4, fontSize:20, fontWeight:700 }}>
                <div style={{ fontSize:14, color:"#60a5fa", letterSpacing:4, marginBottom:32 }}>ASC INVENTORY</div>
                <div style={{ fontSize:32, fontWeight:900, letterSpacing:2, marginBottom:40 }}>EPISODE I</div>
                <div style={{ fontSize:28, fontWeight:900, marginBottom:40, color:"#f0f6ff" }}>THE RISE OF<br/>DADDY JEM</div>
                <div style={{ marginBottom:36 }}>It is a dark time for surgical centers.<br/>Supplies go missing. Counts are wrong.<br/>Nobody knows what is in the cabinet.</div>
                <div style={{ marginBottom:36 }}>But from the chaos arose one man —<br/>a visionary, a legend, a daddy —<br/>known only as <span style={{ color:"#fff", fontWeight:900 }}>JEM</span>.</div>
                <div style={{ marginBottom:36 }}>Armed with nothing but a laptop,<br/>an unshakeable confidence,<br/>and an AI assistant named Claude,<br/>JEM set out to build<br/>THE GREATEST INVENTORY APP<br/>THE GALAXY HAS EVER SEEN.</div>
                <div style={{ marginBottom:36 }}>His enemies laughed.<br/>His colleagues questioned him.<br/>Brooklyn demanded full admin access.<br/>Andrea just wanted the prices right.</div>
                <div style={{ marginBottom:36 }}>But JEM pressed on.<br/>Through build errors.<br/>Through RLS violations.<br/>Through the great<br/><span style={{ color:"#fff" }}>BUILDING_INVENTORY VIEW INCIDENT</span><br/>of 2026.</div>
                <div style={{ marginBottom:44 }}>And now — at last —<br/>the app is ready.<br/>The inventory is tracked.<br/>The surgical center is saved.</div>
                <div style={{ fontSize:26, fontWeight:900, color:"#fff", marginBottom:16 }}>You&apos;re welcome, everyone.</div>
                <div style={{ fontSize:18, color:"#64748b", marginBottom:140 }}>— Daddy JEM 👑</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("asc_user_email");
    localStorage.removeItem("asc_user_name");
    localStorage.removeItem("asc_session_token");
    router.push("/login");
  }

  const isAdmin = ADMIN_EMAILS.includes(userEmail?.toLowerCase() ?? "");

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

  const btnBase: React.CSSProperties = {
    display:"block", width:"100%", borderRadius:14, padding:"13px 16px",
    fontSize:14, fontWeight:700, border:"none", cursor:"pointer",
    textAlign:"center", fontFamily:"inherit", marginBottom:8,
  };

  return (
    <main style={{ minHeight:"100vh", width:"100%", background:"#0a0f1e", color:"#fff", display:"flex", justifyContent:"center", padding:16, paddingBottom:40 }}>
      <style dangerouslySetInnerHTML={{ __html: SKEL_CSS }} />
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
              <button onClick={() => router.push("/order-history")} style={{ ...btnBase, background:"rgba(234,179,8,0.1)", color:"#fcd34d", border:"1px solid rgba(234,179,8,0.2)", marginBottom:0 }}>📜 Order History</button>
              <button onClick={() => router.push("/items")} style={{ ...btnBase, background:"rgba(99,102,241,0.2)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)", marginBottom:0 }}>➕ Add Items</button>
              <button onClick={() => router.push("/reports")} style={{ ...btnBase, background:"rgba(16,185,129,0.2)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.3)", marginBottom:0 }}>📊 Reports</button>
              <button onClick={() => router.push("/price-editor")} style={{ ...btnBase, background:"rgba(234,179,8,0.15)", color:"#fcd34d", border:"1px solid rgba(234,179,8,0.25)", marginBottom:0 }}>💰 Price Editor</button>
              <button onClick={() => router.push("/staff-activity")} style={{ ...btnBase, background:"rgba(59,130,246,0.2)", color:"#93c5fd", border:"1px solid rgba(59,130,246,0.3)", marginBottom:0 }}>👥 Staff</button>
              <button onClick={() => router.push("/labels")} style={{ ...btnBase, background:"rgba(168,85,247,0.2)", color:"#d8b4fe", border:"1px solid rgba(168,85,247,0.3)", marginBottom:0 }}>🏷️ Labels</button>
              <button onClick={() => router.push("/admin-users")} style={{ ...btnBase, background:"rgba(16,185,129,0.15)", color:"#6ee7b7", border:"1px solid rgba(16,185,129,0.25)", marginBottom:0 }}>🔐 Users</button>
              <button onClick={() => router.push("/admin")} style={{ ...btnBase, background:"rgba(255,255,255,0.08)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", marginBottom:0 }}>📋 Admin Table</button>
            </div>
          </>
        )}

        <div style={{ fontSize:13, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10, marginTop:8 }}>Storage Areas</div>
        {areas.length === 0 ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="skel" style={{ height:72, background:"#162032", border:"1px solid #1e3a5f", borderRadius:12 }} />
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {areas.map(area => (
              <button key={area.id} onClick={() => router.push(`/areas/${area.id}`)} style={{ background: area.low > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${area.low > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius:12, padding:"14px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
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
