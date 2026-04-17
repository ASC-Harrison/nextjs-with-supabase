"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 2), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <main style={{minHeight:"100vh",background:"#0a0f1e",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif"}}>
      <div style={{maxWidth:420,width:"100%",background:"#162032",border:"1px solid #1e3a5f",borderRadius:24,padding:"48px 32px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        
        {/* Top gradient line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)"}} />

        {/* Waving guy ASCII art */}
        <pre style={{fontSize:48,lineHeight:1.2,marginBottom:8,fontStyle:"normal"}}>
{frame === 0 ? `( ╹◡╹)ノ` : `ヽ(╹◡╹ )`}
        </pre>

        <div style={{fontSize:26,fontWeight:900,color:"#f0f6ff",letterSpacing:-1,marginBottom:12}}>
          Goodbye! 👋
        </div>

        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:9999,padding:"7px 18px",fontSize:11,fontWeight:800,color:"#fca5a5",letterSpacing:0.8,marginBottom:24}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"blink 1s infinite"}} />
          OFFICIALLY DELETED
        </div>

        <div style={{fontSize:15,color:"#94a3b8",lineHeight:1.8,marginBottom:8}}>
          This app has been officially deleted.<br/>
          It was a good run while it lasted.
        </div>

        <div style={{fontSize:12,color:"#334155",lineHeight:1.7,marginTop:16}}>
          Nothing to see here.<br/>
          Please close the tab and go touch some grass. 🌿
        </div>

      </div>
    </main>
  );
}
