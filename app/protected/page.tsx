// app/protected/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type StorageArea = {
  id: string;
  name: string;
};

type TotalRow = {
  item_id: string;
  name: string;
  barcode: string | null;
  total_on_hand: number;
};

type Tab = "transaction" | "totals" | "settings";

export default function ProtectedPage() {
  const [tab, setTab] = useState<Tab>("transaction");

  // locations
  const [areas, setAreas] = useState<StorageArea[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");
  const [overrideMainOnce, setOverrideMainOnce] = useState(false);

  // transaction
  const [mode, setMode] = useState<"use" | "restock">("use");
  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("Ready");
  const [busy, setBusy] = useState(false);

  // totals
  const [totals, setTotals] = useState<TotalRow[]>([]);
  const [totalsSearch, setTotalsSearch] = useState("");

  const mainSupply = useMemo(
    () => areas.find((a) => a.name.toLowerCase().includes("main") && a.name.toLowerCase().includes("sterile")),
    [areas]
  );

  const activeLocationId = useMemo(() => {
    if (overrideMainOnce && mainSupply?.id) return mainSupply.id;
    return defaultLocationId;
  }, [overrideMainOnce, mainSupply?.id, defaultLocationId]);

  const activeLocationName = useMemo(() => {
    const found = areas.find((a) => a.id === activeLocationId);
    return found?.name || "Select location";
  }, [areas, activeLocationId]);

  // Load locations from storage_areas
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const data = await res.json();
        setAreas(Array.isArray(data?.areas) ? data.areas : []);
      } catch {
        setAreas([]);
      }
    })();
  }, []);

  // pick first location by default
  useEffect(() => {
    if (!defaultLocationId && areas.length) {
      setDefaultLocationId(areas[0].id);
    }
  }, [areas, defaultLocationId]);

  async function loadTotals() {
    setStatus("Loading totals...");
    try {
      const res = await fetch("/api/building-totals", { cache: "no-store" });
      const data = await res.json();
      setTotals(Array.isArray(data?.rows) ? data.rows : []);
      setStatus("Totals loaded");
    } catch {
      setTotals([]);
      setStatus("Failed to load totals");
    }
  }

  useEffect(() => {
    loadTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTotals = useMemo(() => {
    const q = totalsSearch.trim().toLowerCase();
    if (!q) return totals;
    return totals.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.barcode || "").toLowerCase().includes(q)
      );
    });
  }, [totals, totalsSearch]);

  async function submit() {
    if (!activeLocationId) {
      setStatus("Missing location");
      return;
    }
    if (!itemQuery.trim()) {
      setStatus("Enter item name or barcode");
      return;
    }

    setBusy(true);
    setStatus("Submitting...");
    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemQuery,
          locationId: activeLocationId,
          mode,
          qty,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setStatus(`Transaction failed: ${data?.error || res.status}`);
        setBusy(false);
        return;
      }

      setStatus(`✅ ${mode.toUpperCase()} ok (${data.before} → ${data.after})`);

      // one-time override resets after a submit
      if (overrideMainOnce) setOverrideMainOnce(false);

      // refresh totals so your building numbers update
      await loadTotals();

      setItemQuery("");
      setQty(1);
      setBusy(false);
    } catch (e: any) {
      setStatus(`Transaction failed: ${e?.message || "Unknown error"}`);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#2f3136] text-white">
      {/* Header */}
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-[#1f2124] flex items-center justify-center overflow-hidden">
              {/* Logo */}
              <img
                src="/asc-header-logo.png"
                alt="ASC"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="text-xl font-semibold leading-tight">
                Baxter ASC Inventory
              </div>
              <div className="text-sm opacity-70">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>
          </div>

          <div className="rounded-full bg-white/10 px-3 py-2 text-sm">
            Location: <span className="font-semibold">{activeLocationName}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <TabButton active={tab === "transaction"} onClick={() => setTab("transaction")}>
            Transaction
          </TabButton>
          <TabButton active={tab === "totals"} onClick={() => setTab("totals")}>
            Totals
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            Settings
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 pb-10">
        {tab === "transaction" && (
          <Card>
            <div className="text-lg font-semibold mb-3">Transaction</div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                className={`rounded-2xl py-4 font-semibold ${
                  mode === "use" ? "bg-[#d72626]" : "bg-white/10"
                }`}
                onClick={() => setMode("use")}
                disabled={busy}
              >
                USE
              </button>
              <button
                className={`rounded-2xl py-4 font-semibold ${
                  mode === "restock" ? "bg-[#1f9d4a]" : "bg-white/10"
                }`}
                onClick={() => setMode("restock")}
                disabled={busy}
              >
                RESTOCK
              </button>
            </div>

            {/* One-time override button shown on Transaction tab */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
              <div className="text-sm">
                One-time override to <span className="font-semibold">Main Sterile Supply</span>
              </div>
              <button
                className={`rounded-xl px-4 py-2 font-semibold ${
                  overrideMainOnce ? "bg-[#2d6cdf]" : "bg-white/10"
                }`}
                onClick={() => setOverrideMainOnce((v) => !v)}
                disabled={!mainSupply?.id}
              >
                {overrideMainOnce ? "MAIN (1x) ON" : "MAIN (1x)"}
              </button>
            </div>

            <label className="block text-sm opacity-80 mb-2">Item name or barcode</label>
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              className="w-full rounded-2xl bg-white text-black px-4 py-4 text-lg"
              placeholder="Type a name or barcode..."
              disabled={busy}
            />

            <div className="mt-4">
              <label className="block text-sm opacity-80 mb-2">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  className="w-14 h-14 rounded-2xl bg-white/10 text-2xl"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={busy}
                >
                  –
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                  className="flex-1 rounded-2xl bg-white text-black px-4 py-4 text-lg text-center"
                  inputMode="numeric"
                  disabled={busy}
                />
                <button
                  className="w-14 h-14 rounded-2xl bg-white/10 text-2xl"
                  onClick={() => setQty((q) => q + 1)}
                  disabled={busy}
                >
                  +
                </button>
              </div>
            </div>

            <button
              className="mt-5 w-full rounded-2xl bg-black py-4 text-lg font-semibold"
              onClick={submit}
              disabled={busy}
            >
              {busy ? "Submitting..." : "Submit"}
            </button>

            <div className="mt-3 text-sm opacity-90">{status}</div>
          </Card>
        )}

        {tab === "totals" && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Total Inventory (All Locations)</div>
                <div className="text-sm opacity-70">Building totals (auto-summed)</div>
              </div>
              <button className="rounded-xl bg-white/10 px-4 py-2" onClick={loadTotals}>
                Refresh
              </button>
            </div>

            <input
              value={totalsSearch}
              onChange={(e) => setTotalsSearch(e.target.value)}
              className="mt-4 w-full rounded-2xl bg-white text-black px-4 py-3"
              placeholder="Search item or barcode..."
            />

            <div className="mt-4 space-y-3">
              {filteredTotals.map((r) => (
                <div
                  key={r.item_id}
                  className="flex items-center justify-between rounded-2xl bg-white/10 p-4"
                >
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-sm opacity-70">{r.barcode || ""}</div>
                  </div>
                  <div className="rounded-full bg-black px-4 py-2 font-semibold">
                    {r.total_on_hand}
                  </div>
                </div>
              ))}
              {!filteredTotals.length && (
                <div className="text-sm opacity-70">No results</div>
              )}
            </div>
          </Card>
        )}

        {tab === "settings" && (
          <Card>
            <div className="text-lg font-semibold mb-3">Settings</div>

            <label className="block text-sm opacity-80 mb-2">
              Default location (stays set)
            </label>

            <select
              value={defaultLocationId}
              onChange={(e) => setDefaultLocationId(e.target.value)}
              className="w-full rounded-2xl bg-white text-black px-4 py-4 text-lg"
            >
             
