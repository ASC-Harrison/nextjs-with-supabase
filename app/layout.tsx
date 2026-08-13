import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ASC Inventory",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en">
      <head>
        {supabaseUrl ? <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" /> : null}
        {supabaseUrl ? <link rel="dns-prefetch" href={supabaseUrl} /> : null}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ASC Inventory" />
        <meta name="theme-color" content="#0a0f1e" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;}
          html,body{margin:0;padding:0;width:100%;min-height:100vh;background:#0a0f1e;}
          body{-webkit-text-size-adjust:100%;text-size-adjust:100%;}
        `}</style>
      </head>
      <body style={{ margin:0, padding:0, width:"100%", minHeight:"100vh", background:"#0a0f1e" }}>{children}</body>
    </html>
  );
}
