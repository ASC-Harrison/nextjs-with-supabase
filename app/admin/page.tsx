import Link from "next/link";
import AdminGate from "@/components/AdminGate";

export default function AdminHome() {
  return (
    <AdminGate>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-extrabold">Admin Console</div>
              <div className="mt-1 text-sm text-white/60">Control inventory like Supabase — but purpose-built.</div>
            </div>
            <Link href="/app" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">
              Back to App
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <NavCard title="Dashboard" desc="Low stock, totals, and live signals" href="/admin/dashboard" />
            <NavCard title="Inventory Manager" desc="Edit on_hand + par_level fast" href="/admin/inventory" />
            <NavCard title="Audit Log" desc="inventory_events timeline" href="/admin/audit" />
          </div>
        </div>
      </div>
    </AdminGate>
  );
}

function NavCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/10 transition">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-white/70">{desc}</div>
    </Link>
  );
}
