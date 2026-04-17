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
        
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)"}} />

        <pre style={{fontSize:48,lineHeight:1.2,marginBottom:16}}>
{frame === 0 ? `( ╹◡╹)ノ` : `ヽ(╹◡╹ )`}
        </pre>

        <div style={{fontSize:24,fontWeight:900,color:"#f0f6ff",letterSpacing:-0.5,lineHeight:1.4,marginBottom:16}}>
          Brooklyn,<br/>this is a joke —<br/>I would never do that to you bub! 😊
        </div>

        <div style={{fontSize:13,color:"#64748b",lineHeight:1.7}}>
          The app is perfectly fine.<br/>Nothing was deleted. You're safe. 🌸
        </div>

      </div>
    </main>
  );
}
