import "./globals.css";

export const metadata = {
  title: "Baxter ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full w-full overflow-x-hidden">
      <body className="min-h-screen w-full overflow-x-hidden bg-black text-white antialiased">
        {children}

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
