import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "MoneyOS AI",
  description: "Personal finance command center with AI guidance",
  manifest: "/finance-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MoneyOS AI",
  },
};

export const viewport: Viewport = {
  themeColor: "#07101b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
