// components/asc-header.tsx
export default function AscHeader({
  locationLabel,
}: {
  locationLabel?: string | null;
}) {
  return (
    <div className="w-full rounded-3xl bg-zinc-900/80 p-4 text-white ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        {/* LEFT: logo + title */}
        <div className="flex items-center gap-3">
          {/* Logo box */}
          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            {/* NOTE: using plain <img> so it NEVER breaks builds */}
            <img
              src="/asc-header-logo.png"
              alt="ASC"
              className="h-full w-full object-contain p-1"
            />
          </div>

          <div>
            <div className="text-xl font-semibold leading-tight">
              Baxter ASC Inventory
            </div>
            <div className="text-sm text-white/70">
              Cabinet tracking + building totals + low stock alerts
            </div>
          </div>
        </div>

        {/* RIGHT: location badge */}
        <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/10">
          <span className="text-white/60">Location:</span>{" "}
          <span className="font-semibold">
            {locationLabel && locationLabel.trim() ? locationLabel : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
