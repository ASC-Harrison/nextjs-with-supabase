"use client";

import { usePathname, useRouter } from "next/navigation";

const ITEMS = [
  { label: "Home", icon: "⌂", href: "/" },
  { label: "Inventory", icon: "▦", href: "/inventory" },
  { label: "Scan", icon: "⌗", href: "/scan-item" },
  { label: "Chat", icon: "●", href: "/chat" },
];

const HIDDEN_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

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
          .app-mobile-nav-spacer{display:block;height:calc(76px + env(safe-area-inset-bottom))}
          .app-mobile-nav{
            position:fixed;z-index:1000;left:8px;right:8px;bottom:8px;
            min-height:62px;padding:6px 7px calc(6px + env(safe-area-inset-bottom));
            display:grid;grid-template-columns:repeat(4,1fr);gap:4px;
            background:rgba(15,23,42,.94);border:1px solid rgba(148,163,184,.2);
            border-radius:18px;box-shadow:0 18px 48px rgba(0,0,0,.45);
            backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
          }
          .app-mobile-nav button{
            min-width:0;border:0;border-radius:12px;background:transparent;color:#64748b;
            padding:7px 3px 5px;font:700 10px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
            cursor:pointer;-webkit-tap-highlight-color:transparent;
          }
          .app-mobile-nav button.active{background:rgba(59,130,246,.16);color:#93c5fd}
          .app-mobile-nav .nav-icon{font-size:20px;line-height:1}
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
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
