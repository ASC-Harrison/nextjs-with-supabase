// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baxter ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",

  // ✅ makes iOS/standalone use the manifest
  manifest: "/manifest.webmanifest",

  // ✅ nice-to-have for iOS
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ASC Inventory",
  },

  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full w-full overflow-x-hidden">
      <body className="min-h-screen w-full overflow-x-hidden bg-black text-white antialiased">
        {children}

        {/* ✅ register service worker (optional but fine) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== "undefined" && "serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js").catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
