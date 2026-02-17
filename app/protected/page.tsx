"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Mode = "use" | "restock";

type LocationRow = {
  id: string;
  name: string;
};

export default function ProtectedPage() {
  const [mode, setMode] = useState<Mode>("use");
  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);

  // locations + current
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [currentAreaId, setCurrentAreaId] = useState<string>("");
  const [currentAreaName, setCurrentAreaName] = useState<string>("");

  // one-time override (MAIN 1x)
  const [overrideOnce, setOverrideOnce] = useState(false);

  // UI status
  const [status, setStatus] = useState<string>("");

  const trimmed = useMemo(() => itemQuery.trim(), [itemQuery]);

  // ===== Load locations from your API (if you have one)
  // If you DO NOT have /api/locations, this will fail gracefully and show a message
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        if (!res.ok) {
          // show helpful message but don’t crash the page
          setStatus(
            `Failed to load locations (API missing?): ${res.status} ${res.statusText}`
          );
          return;
        }

        const data: any = await res.json();

        // Accept several possible shapes so it doesn't break:
        // { locations: [...] } OR [...] directly
        const list: any[] = Array.isArray(data) ? data : data?.locations || [];
        const parsed: LocationRow[] = list
          .filter((x) => x?.id && x?.name)
          .map((x) => ({ id: String(x.id), name: String(x.name) }));

        setLocations(parsed);

        // Try to set a default location (first one)
        if (parsed.length > 0) {
          setCurrentAreaId(parsed[0].id);
          setCurrentAreaName(parsed[0].name);
        }
      } catch (e: any) {
        setStatus(`Failed to load locations: ${e?.message || "Unknown error"}`);
      }
    })();
  }, []);

  // ===== Scanner hook (optional)
  // If your scanner component sets itemQuery directly, great.
  // This lets you paste barcode into the field too.
  function onScanResult(code: string) {
    setItemQuery(code);
    setStatus(`Scanned: ${code}`);
  }

  async function submitTransaction() {
    setStatus("");

    if (!trimmed) {
      setStatus("❌ Enter an item name or barcode.");
      return;
    }

    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;

    // Decide what location to send
    // If overrideOnce is ON, you can let your API interpret it as "MAIN" 1x
    // Otherwise use currentAreaId
    const payload: any = {
      itemQuery: trimmed, // name OR barcode
      qty: safeQty,
      mode, // "use" | "restock"
      storage_area_id: currentAreaId || null,
      overrideOnce: overrideOnce === true,
    };

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Show "Not in system" if your API returns this code
        if (json?.code === "ITEM_NOT_FOUND") {
          setStatus(`❌ Not in system: ${json?.scanned || trimmed}`);
        } else {
          setStatus(
            `❌ Transaction failed: ${json?.error || res.statusText || "Unknown error"}`
          );
        }
        return;
      }

      // success
      setStatus("✅ Submitted!");

      // If override was used, consume it (one-time)
      if (overrideOnce) setOverrideOnce(false);

      // clear inputs
      setItemQuery("");
      setQty(1);
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message || "Unknown error"}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/70 p-4 shadow">
          <div className="flex items-center gap-3">
            {/* Make sure this image exists in /public */}
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-neutral-800 flex items-center justify-center">
              <Image
                src="/asc-header-logo.png"
                alt="ASC Logo"
                width={48}
                height={48}
                priority
              />
            </div>

            <div className="flex-1">
              <div className="text-2xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-neutral-400">Location:</div>
              <div className="font-semibold">{currentAreaName || "—"}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button className="rounded-xl bg-white px-4 py-2 font-semibold text-black">
            Transaction
          </button>
          <button className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white/80">
            Totals
          </button>
          <button className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white/80">
            Settings
          </button>
        </div>

        {/* One-time override */}
        <div className="mt-4 rounded-2xl bg-neutral-900/70 p-4">
          <div className="text-lg font-semibold">One-time override</div>
          <div className="text-sm text-neutral-300">
            Use MAIN (1x) if you grabbed it from supply room.
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setOverrideOnce(true)}
              className={`rounded-2xl px-4 py-3 font-bold ${
                overrideOnce ? "bg-yellow-500 text-black" : "bg-neutral-800 text-white"
              }`}
            >
              ⚡ MAIN (1x)
            </button>

            <button
              onClick={() => setOverrideOnce(false)}
              className="rounded-2xl bg-neutral-800 px-4 py-3 font-semibold text-white/90"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Mode */}
        <div className="mt-4 rounded-2xl bg-neutral-900/70 p-4">
          <div className="text-lg font-semibold">Mode</div>

          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setMode("use")}
              className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                mode === "use" ? "bg-red-600 text-white" : "bg-neutral-800 text-white/80"
              }`}
            >
              USE
            </button>
            <button
              onClick={() => setMode("restock")}
              className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                mode === "restock"
                  ? "bg-green-600 text-white"
                  : "bg-neutral-800 text-white/80"
              }`}
            >
              RESTOCK
            </button>
          </div>

          {/* Inputs */}
          <div className="mt-4 space-y-3">
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Item name or barcode"
              className="w-full rounded-2xl bg-white px-4 py-4 text-lg text-black outline-none"
            />

            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
              min={1}
              className="w-full rounded-2xl bg-white px-4 py-4 text-lg text-black outline-none"
            />

            <button
              onClick={submitTransaction}
              className="w-full rounded-2xl bg-black px-4 py-5 text-xl font-bold text-white"
            >
              Submit
            </button>

            {/* Status */}
            {status ? (
              <div className="mt-2 text-sm text-neutral-200">{status}</div>
            ) : null}
          </div>

          {/* Optional: quick scan test button (remove later) */}
          <div className="mt-3">
            <button
              onClick={() => onScanResult("TEST-BARCODE-123")}
              className="rounded-xl bg-neutral-800 px-3 py-2 text-sm text-white/80"
            >
              (Test) Simulate scan
            </button>
          </div>
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something
          from the supply room.
        </div>
      </div>
    </div>
  );
}
