"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase/client";

type StorageArea = {
  id: string;        // uuid
  name: string;
};

type Tab = "transaction" | "totals" | "settings";

export default function ProtectedPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [tab, setTab] = useState<Tab>("transaction");

  const [areas, setAreas] = useState<StorageArea[]>([]);
  const [areasError, setAreasError] = useState<string>("");

  const [defaultAreaId, setDefaultAreaId] = useState<string>("");
  const [locked, setLocked] = useState<boolean>(true);
  const [pin, setPin] = useState<string>("");

  // one-time override
  const [overrideOnce, setOverrideOnce] = useState<boolean>(false);

  // transaction form
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [itemQuery, setItemQuery] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("Ready");

  const currentArea = useMemo(
    () => areas.find(a => a.id === defaultAreaId),
    [areas, defaultAreaId]
  );

  const mainAreaId = useMemo(() => {
    // tries to find “Main Sterile Supply” by name
    const m = areas.find(a => a.name.toLowerCase().includes("main sterile"));
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

  // Fetch storage areas (THIS fixes your “locations are gone” problem)
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

        // If nothing selected yet, default to “Main Sterile Supply” if it exists
        if (!defaultAreaId) {
          const main = list.find(a => a.name.toLowerCase().includes("main sterile"));
          if (main) setDefaultAreaId(main.id);
          else if (list[0]) setDefaultAreaId(list[0].id);
        }
      } catch (e: any) {
        if (cancelled) return;
        setAreas([]);
        setAreasError(e?.message || "Failed to load locations.");
      }
    }

    loadAreas();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function unlock() {
    // default PIN: 1234 (you can later move this to DB)
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
      setStatus("Transaction failed: Missing item");
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

      // If override was used, consume it (one-time)
      if (overrideOnce) setOverrideOnce(false);

      setItemQuery("");
      setQty(1);
    } catch (e: any) {
      setStatus(`Transaction failed: ${e?.message || "Unknown error"}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-4">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/70 p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-neutral-800 flex items-center justify-center">
              <Image
  src="/asc-header-logo.png"
  alt="ASC Logo"
  width={80}
  height={80}
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
            className={`flex-1 rounded-xl px-3 py-2 font-semibold ${
              tab === "transaction" ? "bg-white text-black" : "bg-neutral-900 text-white"
            }`}
            onClick={() => setTab("transaction")}
          >
            Transaction
          </button>
          <button
            className={`flex-1 rounded-xl px-3 py-2 font-semibold ${
              tab === "totals" ? "bg-white text-black" : "bg-neutral-900 text-white"
            }`}
            onClick={() => setTab("totals")}
          >
            Totals
          </button>
          <button
            className={`flex-1 rounded-xl px-3 py-2 font-semibold ${
              tab === "settings" ? "bg-white text-black" : "bg-neutral-900 text-white"
            }`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        {tab === "transaction" && (
          <div className="mt-4 space-y-4">
            {/* One-time override */}
            <div className="rounded-2xl bg-neutral-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">One-time override</div>
                  <div className="text-sm text-neutral-300">
                    Use MAIN (1x) if you grabbed it from supply room.
                  </div>
                </div>
                <button
                  className={`rounded-2xl px-4 py-3 font-bold ${
                    overrideOnce ? "bg-blue-600" : "bg-neutral-800"
                  }`}
                  onClick={() => {
                    if (!mainAreaId) {
                      setStatus("No MAIN location found (check storage_areas names).");
                      return;
                    }
                    setOverrideOnce(v => !v);
                  }}
                >
                  ⚡ MAIN<br />(1x)
                </button>
              </div>
            </div>

            {/* Mode */}
            <div className="rounded-2xl bg-neutral-900 p-4">
              <div className="text-lg font-bold mb-3">Mode</div>
              <div className="flex gap-3">
                <button
                  className={`flex-1 rounded-2xl py-3 font-bold ${
                    mode === "USE" ? "bg-red-600" : "bg-neutral-800"
                  }`}
                  onClick={() => setMode("USE")}
                >
                  USE
                </button>
                <button
                  className={`flex-1 rounded-2xl py-3 font-bold ${
                    mode === "RESTOCK" ? "bg-green-600" : "bg-neutral-800"
                  }`}
                  onClick={() => setMode("RESTOCK")}
                >
                  RESTOCK
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl bg-white px-4 py-3 text-black text-lg"
                  placeholder="Item name or barcode"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                />
                <input
                  className="w-full rounded-xl bg-white px-4 py-3 text-black text-lg"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
                <button
                  className="w-full rounded-2xl bg-black py-4 text-xl font-bold"
                  onClick={submitTransaction}
                >
                  Submit
                </button>

                <div className="text-sm text-neutral-300">
                  {areasError
                    ? `Failed to load locations: ${areasError}`
                    : status}
                </div>
              </div>
            </div>

            <div className="text-xs text-neutral-400">
              Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from supply room.
            </div>
          </div>
        )}

        {tab === "totals" && (
          <div className="mt-4 rounded-2xl bg-neutral-900 p-4">
            <div className="text-lg font-bold">Totals</div>
            <div className="text-sm text-neutral-300">
              (We can wire this to your building_inventory view next.)
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="mt-4 space-y-4">
            {/* Lock */}
            <div className="rounded-2xl bg-neutral-900 p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">
                  {locked ? "🔒 Location Locked" : "🔓 Location Unlocked"}
                </div>
                <button
                  className="rounded-xl bg-neutral-800 px-4 py-2 font-semibold"
                  onClick={locked ? unlock : lock}
                >
                  {locked ? "Unlock" : "Lock"}
                </button>
              </div>

              {locked && (
                <div className="mt-3">
                  <input
                    className="w-full rounded-xl bg-neutral-800 px-4 py-3 text-white"
                    placeholder="Enter PIN (default 1234)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                  <button
                    className="mt-3 w-full rounded-xl bg-white py-3 font-bold text-black"
                    onClick={unlock}
                  >
                    Unlock
                  </button>
                </div>
              )}
            </div>

            {/* Location selector */}
            <div className="rounded-2xl bg-neutral-900 p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">Default location</div>
              </div>

              <select
                className="mt-3 w-full rounded-xl bg-neutral-800 px-4 py-3 text-white"
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
                <div className="mt-2 text-sm text-red-300">
                  Failed to load locations: {areasError}
                </div>
              )}
            </div>

            {/* Dark mode note */}
            <div className="rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-300">
              App is currently in <b>dark mode</b>. If you want light mode, tell me and I’ll give you the full `app/layout.tsx` replacement to force light theme.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
