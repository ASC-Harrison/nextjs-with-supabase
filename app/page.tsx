"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Mode = "USE" | "RESTOCK";

type LocationRow = {
  id: string;
  name: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const [tab, setTab] = useState<"Transaction" | "Totals" | "Settings">(
    "Transaction"
  );

  // Locations from YOUR existing data
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [mode, setMode] = useState<Mode>("USE");
  const [mainOverride, setMainOverride] = useState(false);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // Load locations (your existing ones)
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoadingLocations(true);

      // 🔥 CHANGE THIS TABLE NAME ONLY IF YOURS IS DIFFERENT
      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name", { ascending: true });

      if (!mounted) return;

      if (error) {
        console.error("Failed to load locations:", error);
        setLocations([]);
        setLocationId("");
        setLoadingLocations(false);
        return;
      }

      const rows = (data ?? []) as LocationRow[];
      setLocations(rows);
      setLocationId(rows[0]?.id ?? "");
      setLoadingLocations(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const modeHelp = useMemo(() => {
    if (mode === "USE") return "Use removes items from on-hand.";
    return "Restock adds items to on-hand.";
  }, [mode]);

  async function submit() {
    if (!locationId) {
      alert("No location selected.");
      return;
    }
    if (!query.trim()) {
      alert("Type an item or scan a barcode first.");
      return;
    }

    const payload = { locationId, mode, mainOverride, query, qty };

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Transaction failed. Check Vercel logs.");
      return;
    }

    setMainOverride(false); // one-time reset
    setQuery("");
    setQty(1);
    alert("Transaction sent ✅");
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 safe-bottom">
      {/* Header */}
      <div className="pt-4 safe-top">
        <div className="text-sm text-white/70">ASC</div>
        <div className="text-4xl font-bold leading-tight">Inventory</div>
        <div className="mt-2 text-sm text-white/70">
          Cabinet tracking + building totals + low stock alerts
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-3">
        <TabButton
          active={tab === "Transaction"}
          onClick={() => setTab("Transaction")}
        >
          Transaction
        </TabButton>
        <TabButton active={tab === "Totals"} onClick={() => setTab("Totals")}>
          Totals
        </TabButton>
        <TabButton
          active={tab === "Settings"}
          onClick={() => setTab("Settings")}
        >
          Settings
        </TabButton>
      </div>

      {/* Card */}
      <div className="mt-5 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        {/* Location */}
        <div className="text-sm text-white/70">Select location</div>

        <div className="mt-2">
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={loadingLocations || locations.length === 0}
            className="w-full rounded-2xl bg-black/40 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          >
            {loadingLocations ? (
              <option>Loading…</option>
            ) : locations.length === 0 ? (
              <option>No locations found</option>
            ) : (
              locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* One-time override */}
        <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">One-time override</div>
              <div className="mt-1 text-sm text-white/70">
                Grabbed it from{" "}
                <span className="font-semibold text-white/85">MAIN</span> supply
                room? Tap once.
              </div>
            </div>

            <button
              onClick={() => setMainOverride((v) => !v)}
              className={[
                "shrink-0 rounded-2xl px-4 py-3 ring-1 transition",
                mainOverride
                  ? "bg-white text-black ring-white/20"
                  : "bg-black/40 text-white ring-white/10 hover:ring-white/20",
              ].join(" ")}
              aria-pressed={mainOverride}
            >
              <div className="text-xs opacity-80">⚡</div>
              <div className="text-sm font-semibold">
                MAIN <span className="opacity-70">(1x)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Mode */}
        <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Mode</div>
              <div className="mt-1 text-sm text-white/70">{modeHelp}</div>
            </div>

            <div className="flex gap-2">
              <ModeButton
                active={mode === "USE"}
                tone="danger"
                onClick={() => setMode("USE")}
              >
                USE
              </ModeButton>
              <ModeButton
                active={mode === "RESTOCK"}
                tone="neutral"
                onClick={() => setMode("RESTOCK")}
              >
                RESTOCK
              </ModeButton>
            </div>
          </div>
        </div>

        {/* Search / Scan */}
        <div className="mt-4">
          <div className="relative w-full">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan barcode or type item"
              className="w-full rounded-2xl bg-white text-black placeholder-black/50 px-4 py-3 pr-14 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
              inputMode="search"
              autoCapitalize="none"
              autoCorrect="off"
            />

            <button
              type="button"
              onClick={() => alert("Camera scan hook goes here")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-black/10 px-3 py-2 text-black hover:bg-black/20"
              aria-label="Open camera scanner"
            >
              📷
            </button>
          </div>
        </div>

        {/* Qty */}
        <div className="mt-4 flex items-center gap-3">
          <QtyButton onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </QtyButton>

          <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-black ring-1 ring-black/10">
            <span className="text-lg font-semibold">{qty}</span>
          </div>

          <QtyButton onClick={() => setQty((q) => q + 1)}>+</QtyButton>
        </div>

        {/* Confirm */}
        <button
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-black font-semibold hover:bg-white/90 disabled:opacity-60"
          onClick={submit}
          disabled={!query.trim() || !locationId}
        >
          Confirm {mode === "USE" ? "Use" : "Restock"}
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition",
        active
          ? "bg-white text-black ring-white/20"
          : "bg-white/5 text-white ring-white/10 hover:ring-white/20",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  tone,
  children,
  onClick,
}: {
  active: boolean;
  tone: "danger" | "neutral";
  children: React.ReactNode;
  onClick: () => void;
}) {
  const activeCls =
    tone === "danger"
      ? "bg-red-600 text-white ring-red-500/30"
      : "bg-white text-black ring-white/20";
  const inactiveCls =
    "bg-black/30 text-white ring-white/10 hover:ring-white/20";

  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl px-4 py-3 text-sm font-bold ring-1 transition",
        active ? activeCls : inactiveCls,
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function QtyButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-12 w-12 rounded-2xl bg-white/5 text-white text-xl font-semibold ring-1 ring-white/10 hover:ring-white/20"
    >
      {children}
    </button>
  );
}
