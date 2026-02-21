import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen w-full flex justify-center">
      <div className="w-full max-w-md px-3 pb-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-3xl font-extrabold leading-none">Baxter ASC Inventory</div>
          <div className="mt-2 text-sm text-white/60">
            Cabinet tracking + building totals + low stock alerts
          </div>

          <div className="mt-4 grid gap-3">
            <Link
              href="/inventory"
              className="w-full rounded-2xl bg-white px-4 py-4 text-black font-semibold text-center"
            >
              Go directly to Inventory
            </Link>

            <div className="text-xs text-white/50 text-center">
              Tip: Save <span className="font-semibold">/inventory</span> to your Home Screen for the app view.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
