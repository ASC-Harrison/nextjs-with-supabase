export const dynamic = "force-dynamic";

import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import InventoryEditor from "./ui";

export default function InventoryManager() {
  return (
    <AdminGate>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl font-extrabold">Inventory Manager</div>
              <div className="mt-1 text-sm text-white/60">Edit on_hand and par_level like Supabase.</div>
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

          <div className="mt-6">
            <InventoryEditor />
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
