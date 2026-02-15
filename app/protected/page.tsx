"use client";

import { useEffect, useMemo, useState } from "react";

type StorageArea = {
  id: string;
  name: string;
  kind?: string | null; // optional if you have it
};

type ItemRow = {
  item_id: string;
  name: string;
  barcode: string | null;
  total_on_hand: number;
};

export default function ProtectedPage() {
  // ----------------------------
  // Location lock + selection
  // ----------------------------
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");

  // one-time override (MAIN 1x)
  const [overrideOnceLocationId, setOverrideOnceLocationId] = useState<string>("");

  // ----------------------------
  // Transaction UI state
  // ----------------------------
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("Ready");
  const [busy, setBusy] = useState(false);

  // Total inventory list (right panel)
  const [inventorySearch, setInventorySearch] = useState("");
  const [buildingTotals, setBuildingTotals] = useState<ItemRow[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  // the actual location used for the NEXT submit
  const activeLocationId = useMemo(() => {
    return overrideOnceLocationId || defaultLocationId;
  }, [overrideOnceLocationId, defaultLocationId]);

  // ----------------------------
  // Load locations + restore defaults
  // ----------------------------
  useEffect(() => {
    const savedUnlocked = localStorage.getItem("inv_isUnlocked");
    const savedDefaultLocation = localStorage.getItem("inv_defaultLocationId");
    const savedPin = localStorage.getItem("inv_pin");

    if (savedUnlocked === "true") setIsUnlocked(true);
    if (savedDefaultLocation) setDefaultLocationId(savedDefaultLocation);
    if (savedPin) setPin(savedPin);
  }, []);

  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const json = await res.json();

        const areas: StorageArea[] = json?.areas ?? json ?? [];
        setStorageAreas(areas);

        // if we have no default selected yet, pick the first location
        if (!defaultLocationId && areas.length > 0) {
          setDefaultLocationId(areas[0].id);
          localStorage.setItem("inv_defaultLocationId", areas[0].id);
        }

        // if we have a default saved but it doesn't exist anymore, fallback
        if (defaultLocationId && areas.length > 0) {
          const exists = areas.some((a) => a.id === defaultLocationId);
          if (!exists) {
            setDefaultLocationId(areas[0].id);
            localStorage.setItem("inv_defaultLocationId", areas[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------
  // Load building totals
  // ----------------------------
  useEffect(() => {
    async function loadTotals() {
      try {
        const res = await fetch("/api/items?scope=building_totals", { cache: "no-store" });
        const json = await res.json();
        setBuildingTotals(json?.items ?? json ?? []);
      } catch (e) {
        console.error(e);
      }
    }
    loadTotals();
  }, [refreshTick]);

  const filteredTotals = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return buildingTotals;
    return buildingTotals.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [buildingTotals, inventorySearch]);

  // ----------------------------
  // Unlock / Lock
  // ----------------------------
  async function handleUnlock() {
    setStatus("Checking PIN...");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setStatus("Wrong PIN");
        return;
      }

      setIsUnlocked(true);
      localStorage.setItem("inv_isUnlocked", "true");
      localStorage.setItem("inv_pin", pin);
      setStatus("Unlocked");
    } catch (e) {
      console.error(e);
      setStatus("Unlock error");
    }
  }

  function handleLock() {
    setIsUnlocked(false);
    localStorage.setItem("inv_isUnlocked", "false");
    setStatus("Locked");
  }

  // ----------------------------
  // One-time MAIN override
  // ----------------------------
  function setMainOverrideOnce() {
    // Find the location named "Main Sterile Supply" (or whatever you named it)
    const main = storageAreas.find((a) =>
      a.name.toLowerCase().includes("main")
    );
    if (!main) {
      setStatus("Main location not found");
      return;
    }
    setOverrideOnceLocationId(main.id);
    setStatus("One-time MAIN override set");
  }

  function clearOverrideOnce() {
    setOverrideOnceLocationId("");
    setStatus("Override cleared");
  }

  // ----------------------------
  // Submit transaction
  // ----------------------------
  async function submitTransaction() {
    // HARD STOP: if no location, don't submit
    if (!activeLocationId) {
      setStatus("Transaction failed: Missing location (pick a location first)");
      return;
    }

    const qtyInt = Math.max(1, Number(qty) || 1);
    const q = query.trim();
    if (!q) {
      setStatus("Type an item name or barcode");
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
          query: q,
          qty: qtyInt,
          location_id: activeLocationId, // ✅ THIS is what was missing
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setStatus(`Transaction failed: ${json?.error ?? "Unknown error"}`);
        return;
      }

      setStatus("Submitted ✅");

      // If we used the 1-time override, clear it after a successful submit
      if (overrideOnceLocationId) setOverrideOnceLocationId("");

      // refresh totals list
      setRefreshTick((n) => n + 1);
    } catch (e) {
      console.error(e);
      setStatus("Transaction failed: network error");
    } finally {
      setBusy(false);
    }
  }

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-black">Baxter ASC Inventory</div>
            <div className="text-sm text-gray-600">
              Cabinet tracking + building totals + low stock alerts
            </div>
          </div>

          <button
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
            onClick={() => setRefreshTick((n) => n + 1)}
          >
            Refresh
          </button>
        </div>

        {/* ✅ Mobile = 1 column, Desktop = 2 columns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT: Controls */}
          <div className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold">
                {isUnlocked ? "🔓 Location Unlocked" : "🔒 Location Locked"}
              </div>

              {isUnlocked ? (
                <button
                  className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold"
                  onClick={handleLock}
                >
                  Lock
                </button>
              ) : (
                <button
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleUnlock}
                >
                  Unlock
                </button>
              )}
            </div>

            {!isUnlocked && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700">Enter PIN</div>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                />
                <div className="mt-2 text-xs text-gray-500">
                  Unlock lets you change the default location.
                </div>
              </div>
            )}

            {/* Location */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-bold">Default location</div>
                <div className="text-xs text-gray-500">(stays set)</div>
              </div>

              <select
                className="w-full rounded-xl border px-3 py-2"
                value={defaultLocationId}
                disabled={!isUnlocked}
                onChange={(e) => {
                  setDefaultLocationId(e.target.value);
                  localStorage.setItem("inv_defaultLocationId", e.target.value);
                }}
              >
                {storageAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* One-time override */}
              <div className="mt-3 rounded-xl border p-3">
                <div className="text-sm font-bold">One-time override</div>
                <div className="text-xs text-gray-600">
                  If you had to grab from Main supply while your default is a cabinet.
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                    onClick={setMainOverrideOnce}
                  >
                    ⚡ MAIN (1x)
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-gray-200 px-3 py-2 text-sm font-bold"
                    onClick={clearOverrideOnce}
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-2 text-xs text-gray-600">
                  Source for next submit:{" "}
                  <span className="font-semibold">
                    {activeLocationId
                      ? storageAreas.find((a) => a.id === activeLocationId)?.name ?? "Unknown"
                      : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Transaction */}
            <div className="rounded-2xl border p-4">
              <div className="mb-3 text-lg font-black">Transaction</div>

              <div className="mb-3 flex gap-2">
                <button
                  className={`flex-1 rounded-xl border px-3 py-3 text-sm font-black ${
                    mode === "USE" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => setMode("USE")}
                >
                  ⛔ USE
                </button>
                <button
                  className={`flex-1 rounded-xl border px-3 py-3 text-sm font-black ${
                    mode === "RESTOCK" ? "bg-green-700 text-white" : "bg-white"
                  }`}
                  onClick={() => setMode("RESTOCK")}
                >
                  ➕ RESTOCK
                </button>
              </div>

              <input
                className="mb-3 w-full rounded-xl border px-3 py-3"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Item name or barcode"
              />

              <div className="mb-2 text-sm font-bold">Quantity</div>
              <input
                className="mb-4 w-full rounded-xl border px-3 py-3"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />

              <button
                className="w-full rounded-xl bg-black px-4 py-4 text-sm font-black text-white disabled:opacity-60"
                disabled={busy}
                onClick={submitTransaction}
              >
                Submit {mode}
              </button>

              <div className="mt-3 text-sm text-gray-700">{status}</div>

              {/* Helpful guard message */}
              {!activeLocationId && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Pick a location first — your phone screenshot shows it was submitting without a location.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Totals */}
          <div className="rounded-2xl border p-4">
            <div className="mb-2 text-lg font-black">Total Inventory (All Locations)</div>
            <div className="mb-3 text-sm text-gray-600">Building totals (auto-summed)</div>

            <input
              className="mb-3 w-full rounded-xl border px-3 py-3"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              placeholder="Search item or barcode..."
            />

            <div className="space-y-2">
              {filteredTotals.map((r) => (
                <div
                  key={r.item_id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <div className="font-bold">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.barcode ?? ""}</div>
                  </div>
                  <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-black">
                    {r.total_on_hand}
                  </div>
                </div>
              ))}

              {filteredTotals.length === 0 && (
                <div className="rounded-xl border p-3 text-sm text-gray-600">
                  No items match that search.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-400">
          Tip: On phones, everything stacks vertically now (no side-to-side).
        </div>
      </div>
    </div>
  );
}
