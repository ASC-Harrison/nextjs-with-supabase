export const dynamic = "force-dynamic";

import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = supabaseServer();

  // storage_inventory columns (from your screenshots):
  // storage_area_id, item_id, on_hand, par_level, low, low_notified, updated_at
  const { data: lowRows } = await supabase
    .from("storage_inventory")
    .select("storage_area_id, item_id, on_hand, par_level, low, updated_at")
    .eq("low", true)
    .limit(50);

  const { count: lowCount } = await supabase
    .from("storage_inventory")
    .select("*", { count: "exact", head: true })
    .eq("low", true);

  const { count: itemCount } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true });

  const { count: areaCount } = await supabase
    .from("storage_areas")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  return (
    <AdminGate>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl font-extrabold">Dashboard</div>
              <div className="mt-1 text-sm text-white/60">Live inventory signals</div>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10">
                Admin Home
              </Link>
              <Link href="/app" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">
                App
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi title="Low Items" value={String(lowCount ?? 0)} />
            <Kpi title="Active Areas" value={String(areaCount ?? 0)} />
            <Kpi title="Items Catalog" value={String(itemCount ?? 0)} />
          </div>

          <div className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-lg font-semibold">Low Stock (sample)</div>
            <div className="mt-2 text-sm text-white/60">
              This list is raw right now. Next we’ll join names (items + storage_areas) for a premium view.
            </div>

            <div className="mt-4 space-y-2">
              {(lowRows ?? []).length === 0 ? (
                <div className="text-sm text-white/70">No low items found.</div>
              ) : (
                (lowRows ?? []).map((r, idx) => (
                  <div key={idx} className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10 text-sm">
                    <div className="text-white/80">area_id: <span className="text-white">{r.storage_area_id}</span></div>
                    <div className="text-white/80">item_id: <span className="text-white">{r.item_id}</span></div>
                    <div className="text-white/80">
                      on_hand: <span className="text-white">{r.on_hand}</span> / par: <span className="text-white">{r.par_level}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <Link href="/admin/inventory" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">
                Open Inventory Manager
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
    </div>
  );
}
