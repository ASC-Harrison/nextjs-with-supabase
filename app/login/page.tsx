export default function LoginPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0f1e; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif; }
        .root { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .card { max-width: 420px; width: 100%; background: #162032; border: 1px solid #1e3a5f; border-radius: 20px; padding: 40px 32px; text-align: center; position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #ef4444, #f97316, #ef4444); }
        .icon { font-size: 64px; margin-bottom: 20px; display: block; animation: wobble 2s infinite; }
        @keyframes wobble { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        .code { font-size: 72px; font-weight: 900; color: #ef4444; letter-spacing: -4px; line-height: 1; margin-bottom: 8px; }
        .title { font-size: 22px; font-weight: 900; color: #f0f6ff; margin-bottom: 12px; letter-spacing: -0.5px; }
        .msg { font-size: 14px; color: #64748b; line-height: 1.7; margin-bottom: 24px; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 9999px; padding: 8px 18px; font-size: 12px; font-weight: 800; color: #fca5a5; letter-spacing: 0.5px; margin-bottom: 28px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: blink 1.2s infinite; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .footer { font-size: 11px; color: #334155; margin-top: 24px; line-height: 1.6; }
        .footer strong { color: #475569; }
      ` }} />
      <div className="root">
        <div className="card">
          <span className="icon">🚧</span>
          <div className="code">404</div>
          <div className="title">This Page Has Been Deleted</div>
          <div className="badge"><span className="dot" />OFFLINE UNTIL FURTHER NOTICE</div>
          <div className="msg">
            This page packed its bags, said goodbye to nobody,<br />
            and left the building entirely.<br /><br />
            It has been removed and will not be back<br />
            until further notice. Please move along.
          </div>
          <div className="footer">
            If you were looking for the inventory app,<br />
            <strong>go back to the home page.</strong>
          </div>
        </div>
      </div>
    </>
  );
}
