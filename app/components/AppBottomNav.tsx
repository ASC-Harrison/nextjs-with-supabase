"use client";

import { usePathname, useRouter } from "next/navigation";

type IconName = "home" | "inventory" | "scan" | "chat";

const ITEMS: Array<{ label: string; icon: IconName; href: string }> = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Inventory", icon: "inventory", href: "/inventory" },
  { label: "Scan", icon: "scan", href: "/scan-item" },
  { label: "Chat", icon: "chat", href: "/chat" },
];

const HIDDEN_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

function NavIcon({ name }: { name: IconName }) {
  if (name === "home") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2v8.1a.7.7 0 0 1-.7.7h-5.1v-6H8.8v6H3.7a.7.7 0 0 1-.7-.7z"/></svg>;
  }
  if (name === "inventory") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>;
  }
  if (name === "scan") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M7 12h10"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5.2 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 11h.01M12 11h.01M16 11h.01"/></svg>;
}

export default function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (HIDDEN_ROUTES.some(route => pathname.startsWith(route))) return null;

  return (
    <>
      <style>{`
        .app-mobile-nav{display:none}
        .app-mobile-nav-spacer{display:none}
        @media(max-width:700px){
          .app-mobile-nav-spacer{display:block;height:calc(88px + env(safe-area-inset-bottom))}
          .app-mobile-nav{
            position:fixed;z-index:1000;left:10px;right:10px;bottom:8px;
            min-height:67px;padding:7px 8px calc(7px + env(safe-area-inset-bottom));
            display:grid;grid-template-columns:repeat(4,1fr);gap:4px;
            background:linear-gradient(145deg,rgba(17,27,46,.96),rgba(8,13,25,.97));
            border:1px solid rgba(96,165,250,.2);border-radius:21px;
            box-shadow:0 20px 55px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.035);
            backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
          }
          .app-mobile-nav::before{
            content:'';position:absolute;left:18%;right:18%;top:0;height:1px;
            background:linear-gradient(90deg,transparent,rgba(96,165,250,.65),transparent);
          }
          .app-mobile-nav button{
            position:relative;min-width:0;border:0;border-radius:14px;background:transparent;color:#64748b;
            padding:7px 3px 5px;font:750 10px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
            cursor:pointer;-webkit-tap-highlight-color:transparent;
          }
          .app-mobile-nav button::after{
            content:'';position:absolute;bottom:1px;width:4px;height:4px;border-radius:99px;
            background:#60a5fa;opacity:0;transform:scale(.3);transition:.18s ease;
          }
          .app-mobile-nav button.active{
            background:linear-gradient(145deg,rgba(37,99,235,.24),rgba(14,165,233,.1));
            color:#bfdbfe;box-shadow:inset 0 0 0 1px rgba(96,165,250,.12);
          }
          .app-mobile-nav button.active::after{opacity:1;transform:scale(1)}
          .app-mobile-nav .nav-icon{
            width:22px;height:22px;display:grid;place-items:center;transition:transform .18s ease;
          }
          .app-mobile-nav .nav-icon svg{
            width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;
            stroke-linecap:round;stroke-linejoin:round;
          }
          .app-mobile-nav button:nth-child(2) .nav-icon svg path{fill:currentColor;stroke:none}
          .app-mobile-nav button.active .nav-icon{transform:translateY(-1px)}
          .app-mobile-nav button:nth-child(3){
            margin-top:-20px;height:58px;align-self:start;color:#e0f2fe;
            background:linear-gradient(145deg,#2563eb,#0891b2);
            border:3px solid #101a2d;border-radius:18px;
            box-shadow:0 12px 28px rgba(37,99,235,.38);
          }
          .app-mobile-nav button:nth-child(3).active{
            background:linear-gradient(145deg,#3b82f6,#06b6d4);
            box-shadow:0 13px 32px rgba(14,165,233,.45);
          }
          .app-mobile-nav button:nth-child(3)::after{display:none}
          .app-mobile-nav button:nth-child(3) .nav-icon{width:24px;height:24px}
        }
      `}</style>
      <div className="app-mobile-nav-spacer" aria-hidden="true" />
      <nav className="app-mobile-nav" aria-label="Main navigation">
        {ITEMS.map(item => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
