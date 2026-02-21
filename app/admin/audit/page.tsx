export const dynamic = "force-dynamic";

import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Audit() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("inventory_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <AdminGate>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl font-extrabold">Audit Log</div>
              <div className="mt-1 text-sm text-white/60">inventory_events (latest 200)</div>
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

          <div className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            {error ? (
              <div className="text-sm text-red-300">Error: {error.message}</div>
            ) : !data || data.length === 0 ? (
              <div className="text-sm text-white/70">No events found.</div>
            ) : (
              <div className="space-y-3">
                {data.map((e: any) => (
                  <div key={e.id ?? `${e.created_at}-${Math.random()}`} className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                    <div className="text-xs text-white/60">{new Date(e.created_at).toLocaleString()}</div>
                    <div className="mt-2 text-sm break-all">
                      <span className="text-white/70">event:</span>{" "}
                      <span className="text-white">{e.event_type ?? e.type ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/60 break-all">
                      {JSON.stringify(e)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
