"use client";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="text-4xl font-extrabold leading-tight">
          Baxter ASC<br />Inventory
        </div>
        <div className="mt-3 text-white/60">
          Cabinet tracking + building totals + low stock alerts
        </div>

        {/* Funny banner */}
        <div className="mt-6 rounded-2xl text-center py-4 px-4" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)"}}>
          <div style={{fontSize:28,marginBottom:6}}>🚧</div>
          <div style={{fontSize:13,fontWeight:800,color:"#fca5a5",letterSpacing:0.5,marginBottom:4}}>SYSTEM FROZEN — UNTIL FURTHER NOTICE</div>
          <div style={{fontSize:11,color:"#64748b",lineHeight:1.6}}>Nothing to see here. These buttons are on strike.<br/>They refused to work today. We respect that.</div>
        </div>

        {/* Frozen buttons — visible but not clickable */}
        <div className="mt-4 space-y-3" style={{opacity:0.35,pointerEvents:"none",userSelect:"none"}}>
          <div className="block w-full rounded-2xl bg-white text-black font-semibold py-4 text-center cursor-not-allowed">
            🔒 Launch App
          </div>
          <div className="block w-full rounded-2xl bg-white/10 text-white font-semibold py-4 text-center ring-1 ring-white/15 cursor-not-allowed">
            🔒 Admin Inventory (Table View)
          </div>
          <div className="block w-full rounded-2xl bg-blue-600/20 text-blue-300 font-semibold py-4 text-center ring-1 ring-blue-500/30 cursor-not-allowed">
            🔒 Staff Activity
          </div>
        </div>

        <div className="pt-4 text-center text-white/40 text-sm">
          Tip: Add this page to your Home Screen for quick access.
        </div>
      </div>
    </main>
  );
}
