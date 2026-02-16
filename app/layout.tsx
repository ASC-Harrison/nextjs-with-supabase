// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baxter ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",
  applicationName: "Baxter ASC Inventory",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Baxter ASC Inventory",
  },
  icons: {
    icon: [{ url: "/asc-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/asc-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
