"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/barcode-scanner";

type StorageArea = { id: string; name: string };
type Tab = "transaction" | "totals" | "settings";

export default function ProtectedPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  // Tabs
  const [tab, setTab] = useState<Tab>("transaction");

  // Locations
  const [areas, setAreas] = useState<StorageArea[]>([]);
  const [areasError, setAreasError] = useState<string>("");
  const [defaultAreaId, setDefaultAreaId] = useState<string>("");

  // Locking
  const [locked, setLocked] = useState<boolean>(true);
  const [pin, setPin] = useState<string>("");

  // One-time override
  const [overrideOnce, setOverrideOnce] = useState<boolean>(false);

  // Transaction form
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [itemQuery, setItemQuery] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("Ready");

  // Scanner UI
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentArea = useMemo(
    () => areas.find((a) => a.id === defaultAreaId),
    [areas, defaultAreaId]
  );

  const mainAreaId = useMemo(() => {
    const m = areas.find((a) =>
      a.name.toLowerCase().includes("main sterile")
    );
    return m?.id || "";
  }, [areas]);

  // Load saved settings
  useEffect(() => {
    const savedArea = localStorage.getItem("asc_default_area_id") || "";
    const savedLocked = localStorage.getItem("asc_locked");
    const savedOverride = localStorage.getItem("asc_override_once");

    if (savedArea) setDefaultAreaId(savedArea);
    if (savedLocked !== null) setLocked(savedLocked === "true");
    if (savedOverride !== null) setOverrideOnce(savedOverride === "true");
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("asc_default_area_id", defaultAreaId);
  }, [defaultAreaId]);

  useEffect(() => {
    localStorage.setItem("asc_locked", String(locked));
  }, [locked]);

  useEffect(() => {
    localStorage.setItem("asc_override_once", String(overrideOnce));
  }, [overrideOnce]);

  // Fetch storage areas
  useEffect(() => {
    let cancelled = false;

    async function loadAreas() {
      try {
        setAreasError("");

        const { data, error } = await supabase
          .from("storage_areas")
          .select("id,name")
          .order("name", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const list = (data || []) as StorageArea[];
        setAreas(list);

        if (!defaultAreaId) {
          const main = list.find((a) =>
            a.name.toLowerCase().includes("main sterile")
          );
          setDefaultAreaId(main?.id || list[0]?.id || "");
        }
      } catch (e: any) {
        if (cancelled) return;
        setAreas([]);
        setAreasError(e?.message || "Failed to load locations.");
      }
    }

    loadAreas();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Autofocus on transaction tab
  useEffect(() => {
    if (tab === "transaction") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [tab]);

  function unlock() {
    // Change this later to DB if you want.
    if (pin.trim() === "1234") {
      setLocked(false);
      setStatus("Unlocked");
      setPin("");
    } else {
      setStatus("Wrong PIN");
    }
  }

  function lock() {
    setLocked(true);
    setStatus("Locked");
  }

  async function submitTransaction() {
    setStatus("Submitting...");

    const sourceAreaId =
      overrideOnce && mainAreaId ? mainAreaId : defaultAreaId;

    if (!sourceAreaId) {
      setStatus("Transaction failed: Missing location");
      return;
    }
    if (!itemQuery.trim()) {
      setStatus("Transaction failed: Missing item/barcode");
      return;
    }
    if (!qty || qty < 1) {
      setStatus("Transaction failed: Qty must be 1+");
      return;
    }

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemQuery: itemQuery.trim(),
          qty,
          mode,
          storage_area_id: sourceAreaId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`Transaction failed: ${json?.error || res.statusText}`);
        return;
      }

      setStatus("✅ Submitted");

      // consume one-time override
      if (overrideOnce) setOverrideOnce(false);

      // clear inputs
      setItemQuery("");
      setQty(1);

      // refocus for fast scanning
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e: any) {
      setStatus(`Transaction failed: ${e?.message || "Unknown error"}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-4">
        {/* Header */}
        <div className="rounded-3xl bg-neutral-900/70 p-4 shadow ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/10">
              <Image
                src="/asc-header-logo.png"
                alt="ASC Logo"
                width={96}
                height={96}
                priority
              />
            </div>

            <div className="flex-1">
              <div className="text-2xl font-bold leading-tight">
                Baxter ASC Inventory
              </div>
              <div className="text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right text-sm text-neutral-300">
              <div>Location:</div>
              <div className="font-semibold text-white">
                {currentArea?.name || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            className={`flex-1 rounded-2xl px-3 py-3 font-bold ${
              tab === "transaction"
                ? "bg-white text-black"
                : "bg-neutral-900 text-white ring-1 ring-white/10"
            }`}
            onClick={() => setTab("transaction")}
          >
            Transaction
          </button>
          <button
            className={`flex-1 rounded-2xl px-3 py-3 font-bold ${
              tab === "totals"
                ? "bg-white text-black"
                : "bg-neutral-900 text-white ring-1 ring-white/10"
            }`}
            onClick={() => setTab("totals")}
          >
            Totals
          </button>
          <button
            className={`flex-1 rounded-2xl px-3 py-3 font-bold ${
              tab === "settings"
                ? "bg-white text-black"
                : "bg-neutral-900 text-white ring-1 ring-white/10"
            }`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </div>

        {/* Transaction Tab */}
        {tab === "transaction" && (
          <div className="mt-4 space-y-4">
            {/* One-time override */}
            <div className="rounded-3xl bg-neutral-900 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">One-time override</div>
                  <div className="text-sm text-neutral-300">
                    Use MAIN (1x) if you grabbed it from supply room.
                  </div>
                </div>
                <button
                  className={`rounded-2xl px-4 py-3 font-black ${
                    overrideOnce ? "bg-blue-600" : "bg-neutral-800"
                  } ring-1 ring-white/10`}
                  onClick={() => {
                    if (!mainAreaId) {
                      setStatus(
                        "No MAIN location found (name must include 'Main Sterile')."
                      );
                      return;
                    }
                    setOverrideOnce((v) => !v);
                  }}
                >
                  ⚡ MAIN<br />(1x)
                </button>
              </div>
            </div>

            {/* Mode + Inputs */}
            <div className="rounded-3xl bg-neutral-900 p-4 ring-1 ring-white/10">
              <div className="text-lg font-bold mb-3">Mode</div>

              <div className="flex gap-3">
                <button
                  className={`flex-1 rounded-2xl py-3 font-black ${
                    mode === "USE" ? "bg-red-600" : "bg-neutral-800"
                  } ring-1 ring-white/10`}
                  onClick={() => setMode("USE")}
                >
                  USE
                </button>
                <button
                  className={`flex-1 rounded-2xl py-3 font-black ${
                    mode === "RESTOCK" ? "bg-green-600" : "bg-neutral-800"
                  } ring-1 ring-white/10`}
                  onClick={() => setMode("RESTOCK")}
                >
                  RESTOCK
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {/* Barcode/Item Input */}
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 text-black text-lg"
                    placeholder="Scan or type item name / barcode"
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    onKeyDown={(e) => {
                      // Bluetooth scanners usually send Enter
                      if (e.key === "Enter") submitTransaction();
                    }}
                  />
                  <button
                    className="rounded-2xl bg-neutral-800 px-4 py-3 font-bold ring-1 ring-white/10"
                    onClick={() => setScannerOpen(true)}
                  >
                    📷
                    <div className="text-[10px] font-semibold text-white/70">
                      Scan
                    </div>
                  </button>
                </div>

                {/* Qty */}
                <input
                  className="w-full rounded-2xl bg-white px-4 py-3 text-black text-lg"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />

                {/* Submit */}
                <button
                  className="w-full rounded-2xl bg-black py-4 text-xl font-black ring-1 ring-white/10"
                  onClick={submitTransaction}
                >
                  Submit
                </button>

                <div className="text-sm text-neutral-300">
                  {areasError ? `Locations error: ${areasError}` : status}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Totals Tab */}
        {tab === "totals" && (
          <div className="mt-4 rounded-3xl bg-neutral-900 p-4 ring-1 ring-white/10">
            <div className="text-lg font-bold">Totals</div>
            <div className="text-sm text-neutral-300">
              Next: hook this to your building_inventory view.
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="mt-4 space-y-4">
            {/* Lock */}
            <div className="rounded-3xl bg-neutral-900 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">
                  {locked ? "🔒 Location Locked" : "🔓 Location Unlocked"}
                </div>
                <button
                  className="rounded-2xl bg-neutral-800 px-4 py-2 font-bold ring-1 ring-white/10"
                  onClick={locked ? unlock : lock}
                >
                  {locked ? "Unlock" : "Lock"}
                </button>
              </div>

              {locked && (
                <div className="mt-3">
                  <input
                    className="w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white"
                    placeholder="Enter PIN (default 1234)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                  <button
                    className="mt-3 w-full rounded-2xl bg-white py-3 font-black text-black"
                    onClick={unlock}
                  >
                    Unlock
                  </button>
                </div>
              )}
            </div>

            {/* Location selector */}
            <div className="rounded-3xl bg-neutral-900 p-4 ring-1 ring-white/10">
              <div className="text-lg font-bold">Default location</div>

              <select
                className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white"
                value={defaultAreaId}
                onChange={(e) => {
                  if (locked) {
                    setStatus("Locked: enter PIN to change location.");
                    return;
                  }
                  setDefaultAreaId(e.target.value);
                  setStatus("Location updated");
                }}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {areasError && (
                <div className="mt-2 text-sm text-red-200">
                  {areasError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {scannerOpen && (
        <BarcodeScanner
          onScan={(value) => {
            setItemQuery(value);
            setTimeout(() => inputRef.current?.focus(), 150);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
