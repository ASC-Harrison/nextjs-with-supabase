export default function HomePage() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Baxter ASC Inventory
        </h1>

        <p className="mt-3 text-white/70">
          Cabinet tracking + building totals + low stock alerts
        </p>

        <div className="mt-8 flex flex-col gap-3 items-center">
          <a
            href="/launch"
            className="w-full max-w-sm rounded-2xl bg-white text-black px-5 py-4 font-bold"
          >
            Launch App
          </a>

          <a
            href="/inventory"
            className="w-full max-w-sm rounded-2xl bg-white/10 text-white px-5 py-4 font-semibold ring-1 ring-white/15"
          >
            Go Directly to Inventory
          </a>
        </div>

        <div className="mt-8 text-xs text-white/50">
          Save <span className="font-semibold">/inventory</span> to your Home Screen for full app mode.
        </div>
      </div>
    </main>
  );
}
