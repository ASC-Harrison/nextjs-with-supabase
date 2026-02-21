export const dynamic = "force-dynamic";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10 ring-1 ring-white/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">ASCInventory</div>
              <div className="text-xs text-white/60">Surgical supply intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Launch App
            </Link>
            <Link
              href="/admin"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/15"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-[32rem] w-[32rem] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-green-500/70" />
              Built for ASC cabinet + main supply workflows
            </div>

            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-6xl">
              Inventory control that feels{" "}
              <span className="text-white/70">enterprise</span>.
            </h1>

            <p className="mt-5 text-base text-white/70 sm:text-lg">
              Barcode transactions, cabinet-level tracking, low-stock alerts, and admin oversight — designed
              for real OR pace. Fast. Clean. Auditable.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
              >
                Launch Inventory App
              </Link>
              <Link
                href="/admin"
                className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/15"
              >
                Open Admin Console
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat k="Cabinet-first" v="Workflow" />
              <Stat k="PIN-locked" v="Controls" />
              <Stat k="Event log" v="Audit-ready" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card
            title="Real-time cabinet tracking"
            desc="Each storage area is its own source of truth — OR cabinets, carts, main supply. No guessing."
          />
          <Card
            title="Barcode-first transactions"
            desc="Scan or type. Fast lookup. Update on-hand instantly with USE/RESTOCK modes."
          />
          <Card
            title="Admin-grade control panel"
            desc="Edit par levels and on-hand values like Supabase — but cleaner and purpose-built."
          />
          <Card
            title="Audit timeline"
            desc="Every change can be logged in inventory_events to support reviews and accountability."
          />
        </div>

        <div className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="text-xl font-semibold">Ready to run this as a real product?</div>
          <div className="mt-2 text-sm text-white/70">
            Next steps: staff identities, role-based access, multi-site, automated purchasing workflows.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/app" className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black">
              Go to App
            </Link>
            <Link
              href="/admin"
              className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold ring-1 ring-white/10"
            >
              Go to Admin
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-5 text-xs text-white/50">
          © {new Date().getFullYear()} ASCInventory — Built for surgical centers.
        </div>
      </footer>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="text-xs text-white/60">{k}</div>
      <div className="mt-1 text-lg font-semibold">{v}</div>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-white/70">{desc}</div>
    </div>
  );
}
