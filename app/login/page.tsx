"use client";

export default function LoginPage() {
  return (
    <div style={{minHeight:"100vh",background:"#0a0f1e",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif"}}>
      <div style={{maxWidth:420,width:"100%",background:"#162032",border:"1px solid #1e3a5f",borderRadius:20,padding:"40px 32px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#ef4444,#f97316,#ef4444)"}} />
        <div style={{fontSize:64,marginBottom:20}}>🚧</div>
        <div style={{fontSize:72,fontWeight:900,color:"#ef4444",letterSpacing:-4,lineHeight:1,marginBottom:8}}>404</div>
        <div style={{fontSize:22,fontWeight:900,color:"#f0f6ff",marginBottom:12,letterSpacing:-0.5}}>This Page Has Been Deleted</div>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:9999,padding:"8px 18px",fontSize:12,fontWeight:800,color:"#fca5a5",letterSpacing:0.5,marginBottom:28}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block"}} />
          OFFLINE UNTIL FURTHER NOTICE
        </div>
        <div style={{fontSize:14,color:"#64748b",lineHeight:1.8,marginBottom:24}}>
          This page packed its bags, said goodbye to nobody,<br/>
          and left the building entirely.<br/><br/>
          It has been removed and will not be back<br/>
          until further notice. Please move along.
        </div>
        <div style={{fontSize:11,color:"#334155",lineHeight:1.6}}>
          If you were looking for the inventory app,<br/>
          <span style={{color:"#475569",fontWeight:700}}>go back to the home page.</span>
        </div>
      </div>
    </div>
  );
}
