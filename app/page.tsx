"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="text-4xl font-extrabold leading-tight">
          Baxter ASC<br />Inventory
        </div>
        <div className="mt-3 text-white/60">
          Cabinet tracking + building totals + low stock alerts
        </div>
        <div className="mt-8 space-y-3">
          <Link href="/inventory" className="block w-full rounded-2xl bg-white text-black font-semibold py-4 text-center">
            Launch App
          </Link>
          <Link href="/admin" className="block w-full rounded-2xl bg-white/10 text-white font-semibold py-4 text-center ring-1 ring-white/15">
            Admin Inventory (Table View)
          </Link>
          <Link href="/staff-activity" className="block w-full rounded-2xl bg-blue-600/20 text-blue-300 font-semibold py-4 text-center ring-1 ring-blue-500/30">
            👥 Staff Activity
          </Link>
          <Link href="/labels" className="block w-full rounded-2xl bg-purple-600/20 text-purple-300 font-semibold py-4 text-center ring-1 ring-purple-500/30">
            🏷️ Print QR Labels
          </Link>
        </div>
        <div className="pt-4 text-center text-white/40 text-sm">
          Tip: Add this page to your Home Screen for quick access.
        </div>
      </div>
    </main>
  );
}
