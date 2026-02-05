import "./globals.css";

export const metadata = {
  title: "ASC Inventory Live",
  description: "Inventory scan + low stock alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
