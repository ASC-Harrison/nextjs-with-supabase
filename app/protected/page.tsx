"use client";

import { useEffect, useMemo, useState } from "react";

type LocationRow = {
  id: string;
  name: string;
};

type TotalsRow = {
  item_id: string;
  name: string;
  barcode: string | null;
  total_on_hand: number;
};

export default function ProtectedPage() {
  // --------- UI tabs ----------
  type Tab = "transaction" | "totals" | "settings";
  const [tab, setTab] = useState<Tab>("transaction");

  // --------- location ----------
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");

  // One-time override (MAIN 1x)
  const [overrideOnce, setOverrideOnce] = useState<boolean>(false);

  // --------- transaction ----------
  const [mode, setMode] = useState<"use" | "restock">("use");
  const [itemQuery, setItemQuery] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("Ready");
  const [busy, setBusy] = useState<boolean>(false);

  // --------- totals ----------
  const [totals, setTotals] = useState<TotalsRow[]>([]);
  const [totalsSearch, setTotalsSearch] = useState<string>("");

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

  // --------- fetch locations + initial data ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        const json = await res.json();

        const rows: LocationRow[] = json.locations || [];
        setLocations(rows);

        // Default to first location if none selected
        if (rows.length > 0) {
          setLocationId(rows[0].id);
          setLocationName(rows[0].name);
        }
      } catch (e: any) {
        setStatus(`Failed to load locations: ${e?.message || e}`);
      }
    })();
  }, []);

  async function refreshTotals() {
    try {
      const res = await fetch("/api/totals", { cache: "no-store" });
      const json = await res.json();
      setTotals(json.totals || []);
    } catch (e: any) {
      setStatus(`Failed to load totals: ${e?.message || e}`);
    }
  }

  useEffect(() => {
    refreshTotals();
  }, []);

  // When locationId changes, update locationName
  useEffect(() => {
    const found = locations.find((l) => l.id === locationId);
    setLocationName(found?.name || "");
  }, [locationId, locations]);

  // Effective source location for the next submit
  const effectiveLocationId = useMemo(() => {
    if (!overrideOnce) return locationId;

    // If you use MAIN 1x, we try to find a location named "Main Sterile Supply"
    const main = locations.find((l) => l.name === "Main Sterile Supply");
    return main?.id || locationId;
  }, [overrideOnce, locationId, locations]);

  const effectiveLocationName = useMemo(() => {
    if (!overrideOnce) return locationName;
    const main = locations.find((l) => l.name === "Main Sterile Supply");
    return main?.name || locationName;
  }, [overrideOnce, locationName, locations]);

  async function submitTransaction() {
    if (!effectiveLocationId) {
      setStatus("Transaction failed: Missing location");
      return;
    }
    if (!itemQuery.trim()) {
      setStatus("Transaction failed: Missing item name/barcode");
      return;
    }
    if (!qty || qty < 1) {
      setStatus("Transaction failed: Quantity must be 1+");
      return;
    }

    setBusy(true);
    setStatus("Submitting...");

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          itemQuery: itemQuery.trim(),
          qty,
          locationId: effectiveLocationId,
        }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        setStatus(`Transaction failed: ${json?.error || res.statusText}`);
      } else {
        setStatus("Submitted ✅");
        setItemQuery("");
        setQty(1);

        // One-time override resets after submit
        if (overrideOnce) setOverrideOnce(false);

        // refresh totals after successful submit
        refreshTotals();
      }
    } catch (e: any) {
      setStatus(`Transaction failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-4 rounded-2xl bg-neutral-900 p-4 border border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Logo placeholder (image can be added later) */}
              <div className="h-12 w-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                ?
              </div>

              <div>
                <div className="text-xl font-semibold leading-tight">
                  Baxter ASC Inventory
                </div>
                <div className="text-xs text-neutral-400">
                  Cabinet tracking + building totals + low stock alerts
                </div>
              </div>
            </div>

            <div className="text-xs text-neutral-400 text-right">
              <div>Location:</div>
              <div className="font-semibold text-white">
                {effectiveLocationName || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <button
            className={`rounded-xl py-2 text-sm font-semibold border ${
              tab === "transaction"
                ? "bg-white text-black border-white"
                : "bg-neutral-900 text-white border-neutral-800"
            }`}
            onClick={() => setTab("transaction")}
          >
            Transaction
          </button>
          <button
            className={`rounded-xl py-2 text-sm font-semibold border ${
              tab === "totals"
                ? "bg-white text-black border-white"
                : "bg-neutral-900 text-white border-neutral-800"
            }`}
            onClick={() => setTab("totals")}
          >
            Totals
          </button>
          <button
            className={`rounded-xl py-2 text-sm font-semibold border ${
              tab === "settings"
                ? "bg-white text-black border-white"
                : "bg-neutral-900 text-white border-neutral-800"
            }`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </div>

        {/* Transaction Tab */}
        {tab === "transaction" && (
          <div className="rounded-2xl bg-neutral-900 p-4 border border-neutral-800 space-y-4">
            {/* One-time override visible here */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-neutral-950 border border-neutral-800 p-3">
              <div className="text-sm">
                <div className="font-semibold">One-time override</div>
                <div className="text-xs text-neutral-400">
                  Use MAIN (1x) if you grabbed it from supply room.
                </div>
              </div>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
                  overrideOnce
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-neutral-900 border-neutral-700 text-white"
                }`}
                onClick={() => setOverrideOnce((v) => !v)}
                type="button"
              >
                ⚡ MAIN (1x)
              </button>
            </div>

            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3">
              <div className="text-sm font-semibold mb-2">Mode</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`rounded-xl py-3 text-sm font-bold border ${
                    mode === "use"
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-neutral-900 border-neutral-700 text-white"
                  }`}
                  onClick={() => setMode("use")}
                  type="button"
                >
                  USE
                </button>
                <button
                  className={`rounded-xl py-3 text-sm font-bold border ${
                    mode === "restock"
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-neutral-900 border-neutral-700 text-white"
                  }`}
                  onClick={() => setMode("restock")}
                  type="button"
                >
                  RESTOCK
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <input
                className="w-full rounded-xl bg-white text-black px-3 py-3 text-base"
                placeholder="Item name or barcode"
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
              />
              <input
                className="w-full rounded-xl bg-white text-black px-3 py-3 text-base"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>

            <button
              className="w-full rounded-xl bg-black text-white py-4 font-bold text-lg disabled:opacity-60"
              onClick={submitTransaction}
              disabled={busy}
              type="button"
            >
              {busy ? "Submitting..." : "Submit"}
            </button>

            <div className="text-sm text-neutral-300">{status}</div>
          </div>
        )}

        {/* Totals Tab */}
        {tab === "totals" && (
          <div className="rounded-2xl bg-neutral-900 p-4 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Total Inventory</div>
                <div className="text-xs text-neutral-400">
                  Building totals (auto-summed)
                </div>
              </div>
              <button
                className="rounded-xl px-3 py-2 text-sm font-semibold bg-neutral-950 border border-neutral-800"
                onClick={refreshTotals}
                type="button"
              >
                Refresh
              </button>
            </div>

            <input
              className="w-full rounded-xl bg-white text-black px-3 py-3 text-base"
              placeholder="Search item or barcode..."
              value={totalsSearch}
              onChange={(e) => setTotalsSearch(e.target.value)}
            />

            <div className="space-y-2">
              {filteredTotals.map((r) => (
                <div
                  key={r.item_id}
                  className="rounded-xl bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-neutral-400">
                      {r.barcode || "—"}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold">
                    {r.total_on_hand}
                  </div>
                </div>
              ))}
              {filteredTotals.length === 0 && (
                <div className="text-sm text-neutral-400">No items found.</div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="rounded-2xl bg-neutral-900 p-4 border border-neutral-800 space-y-3">
            <div>
              <div className="text-sm font-semibold">Default location</div>
              <div className="text-xs text-neutral-400">
                Choose where this device normally uses/restocks from.
              </div>
            </div>

            <select
              className="w-full rounded-xl bg-white text-black px-3 py-3 text-base"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <div className="text-xs text-neutral-400">
              Current:{" "}
              <span className="text-white font-semibold">
                {locationName || "—"}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-neutral-500">
          Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab
          something from the supply room.
        </div>
      </div>
    </div>
  );
}
