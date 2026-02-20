import "./globals.css";

export const metadata = {
  title: "ASC Inventory",
  description: "Cabinet tracking + building totals + low stock alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-black text-white antialiased overflow-x-hidden">
        <div className="min-h-dvh w-full overflow-x-hidden">{children}</div>
      </body>
    </html>
  );
}
