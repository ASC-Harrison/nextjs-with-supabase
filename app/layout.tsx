import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Baxter ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full w-full overflow-x-hidden">
      <body className="min-h-screen w-full overflow-x-hidden bg-black text-white antialiased">
        {children}

        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
