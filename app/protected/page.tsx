"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type LocationRow = {
  id: string;
  name: string;
};

type Mode = "USE" | "RESTOCK";

type TxResponseOk = {
  ok: true;
  item?: { id?: string; name?: string; barcode?: string };
  on_hand?: number;
};

type TxResponseErr = {
  ok?: false;
  code?: string; // e.g. "ITEM_NOT_FOUND"
  error?: string;
  scanned?: string;
};

export default function ProtectedPage() {
  // ---------- UI State ----------
  const [activeTab, setActiveTab] = useState<"transaction" | "totals" | "settings">(
    "transaction"
  );

  const [mode, setMode] = useState<Mode>("USE");
  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("");

  // Locations
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationError, setLocationError] = useState<string>("");
  const [currentLocationId, setCurrentLocationId] = useState<string>("");
  const currentLocation = useMemo(
    () => locations.find((l) => l.id === currentLocationId) || null,
    [locations, currentLocationId]
  );

  // One-time override (MAIN 1x)
  const [overrideOnce, setOverrideOnce] = useState(false);

  // Camera scanning
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  // ---------- Load locations ----------
  useEffect(() => {
    (async () => {
      try {
        setLocationError("");
        const res = await fetch("/api/locations", { cache: "no-store" });
        const json = (await res.json()) as any;

        if (!res.ok) {
          const msg =
            typeof json?.error === "string"
              ? json.error
              : "Failed to load locations.";
          setLocationError(msg);
          setLocations([]);
          return;
        }

        // Support either: { locations: [...] } or plain array
        const list: LocationRow[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.locations)
          ? json.locations
          : [];

        if (!Array.isArray(list)) {
          setLocationError("Failed to load locations: unexpected response.");
          setLocations([]);
          return;
        }

        setLocations(list);

        // Restore saved location
        const saved = typeof window !== "undefined" ? localStorage.getItem("asc_location_id") : null;
        const first = list[0]?.id || "";

        const pick = saved && list.some((l) => l.id === saved) ? saved : first;
        if (pick) {
          setCurrentLocationId(pick);
          if (typeof window !== "undefined") localStorage.setItem("asc_location_id", pick);
        }
      } catch (e: any) {
        setLocations([]);
        setLocationError(`Failed to load locations: ${e?.message || "Unknown error"}`);
      }
    })();
  }, []);

  // ---------- Save location selection ----------
  function handleChangeLocation(id: string) {
    setCurrentLocationId(id);
    if (typeof window !== "undefined") localStorage.setItem("asc_location_id", id);
  }

  // ---------- Transaction submit ----------
  async function submitTransaction() {
    setStatus("");

    const trimmed = itemQuery.trim();
    if (!trimmed) {
      setStatus("❌ Enter an item name or barcode first.");
      return;
    }
    if (!currentLocationId) {
      setStatus("❌ No location selected.");
      return;
    }
    if (!qty || qty <= 0) {
      setStatus("❌ Quantity must be at least 1.");
      return;
    }

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemQuery: trimmed,
          qty,
          mode,
          storage_area_id: overrideOnce ? "MAIN" : currentLocationId, // server can interpret "MAIN" if you use that
          override_once: overrideOnce,
        }),
      });

      // ✅ THIS is what you were missing before:
      const json = (await res.json()) as TxResponseOk & TxResponseErr;

      if (!res.ok) {
        if (json?.code === "ITEM_NOT_FOUND") {
          setStatus(`❌ Not in system: ${json?.scanned || trimmed}`);
        } else {
          setStatus(`❌ Transaction failed: ${json?.error || res.statusText}`);
        }
        return;
      }

      setStatus("✅ Submitted!");

      // If override was used, consume it (one-time)
      if (overrideOnce) setOverrideOnce(false);

      // Clear fields
      setItemQuery("");
      setQty(1);
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message || "Unknown error"}`);
    }
  }

  // ---------- Scanner helpers ----------
  async function openScanner() {
    setCameraError("");
    setScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Try BarcodeDetector if available
      const AnyWindow = window as any;
      if (!AnyWindow.BarcodeDetector) {
        setCameraError("Camera opened. This device/browser doesn’t support auto barcode detection here. Type or use a handheld scanner into the input.");
        return;
      }

      const detector = new AnyWindow.BarcodeDetector({
        formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"],
      });

      // Scan loop (every ~300ms)
      scanTimerRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current) return;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0]?.rawValue || "";
            if (raw) {
              setItemQuery(raw);
              closeScanner();
            }
          }
        } catch {
          // ignore detect errors
        }
      }, 300);
    } catch (e: any) {
      setCameraError(e?.message || "Could not open camera.");
    }
  }

  function closeScanner() {
    setScannerOpen(false);
    setCameraError("");

    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // Ensure camera stops if tab changes/unmounts
  useEffect(() => {
    return () => closeScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-4">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/70 p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-neutral-800 flex items-center justify-center">
              {/* If you have your logo in /public/logo.png this will show */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ASC Logo" className="h-12 w-12 object-contain" onError={(e) => ((e.currentTarget.style.display = "none"))} />
              <span className="text-xl font-bold">?</span>
            </div>

            <div className="flex-1">
              <div className="text-2xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-neutral-400">Location:</div>
              <div className="font-semibold">{currentLocation?.name || "—"}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <TabButton active={activeTab === "transaction"} onClick={() => setActiveTab("transaction")}>
              Transaction
            </TabButton>
            <TabButton active={activeTab === "totals"} onClick={() => setActiveTab("totals")}>
              Totals
            </TabButton>
            <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
              Settings
            </TabButton>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 rounded-3xl bg-neutral-900/60 p-4 shadow">
          {activeTab === "transaction" && (
            <>
              {/* One-time override */}
              <div className="rounded-2xl bg-neutral-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">One-time override</div>
                    <div className="text-sm text-neutral-300">
                      Use <b>MAIN (1x)</b> if you grabbed it from supply room.
                    </div>
                  </div>

                  <button
                    onClick={() => setOverrideOnce((v) => !v)}
                    className={`h-20 w-28 rounded-2xl border px-3 py-2 font-bold ${
                      overrideOnce
                        ? "border-yellow-400 bg-yellow-400/15"
                        : "border-neutral-700 bg-neutral-900"
                    }`}
                  >
                    <div className="text-xl">⚡</div>
                    <div>MAIN</div>
                    <div className="text-sm font-semibold">(1x)</div>
                  </button>
                </div>
              </div>

              {/* Mode */}
              <div className="mt-4 rounded-2xl bg-neutral-950/40 p-4">
                <div className="text-lg font-semibold">Mode</div>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => setMode("USE")}
                    className={`flex-1 rounded-2xl px-4 py-4 text-xl font-bold ${
                      mode === "USE" ? "bg-red-600" : "bg-neutral-900 border border-neutral-700"
                    }`}
                  >
                    USE
                  </button>
                  <button
                    onClick={() => setMode("RESTOCK")}
                    className={`flex-1 rounded-2xl px-4 py-4 text-xl font-bold ${
                      mode === "RESTOCK"
                        ? "bg-green-600"
                        : "bg-neutral-900 border border-neutral-700"
                    }`}
                  >
                    RESTOCK
                  </button>
                </div>
              </div>

              {/* Inputs */}
              <div className="mt-4 rounded-2xl bg-neutral-950/40 p-4">
                <div className="flex gap-2">
                  <input
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    placeholder="Item name or barcode"
                    className="w-full rounded-2xl bg-white px-4 py-4 text-lg text-black outline-none"
                  />
                  <button
                    onClick={scannerOpen ? closeScanner : openScanner}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 font-bold"
                  >
                    {scannerOpen ? "Close" : "Scan"}
                  </button>
                </div>

                {scannerOpen && (
                  <div className="mt-3 rounded-2xl border border-neutral-800 bg-black p-2">
                    <video ref={videoRef} className="h-56 w-full rounded-xl object-cover" playsInline />
                    {cameraError && (
                      <div className="mt-2 text-sm text-yellow-300">{cameraError}</div>
                    )}
                    <div className="mt-2 text-xs text-neutral-400">
                      Tip: If detection isn’t supported here, you can still scan with a handheld USB/Bluetooth scanner into the input.
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <input
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    type="number"
                    min={1}
                    className="w-full rounded-2xl bg-white px-4 py-4 text-lg text-black outline-none"
                  />
                </div>

                <button
                  onClick={submitTransaction}
                  className="mt-4 w-full rounded-2xl bg-black px-4 py-5 text-xl font-bold"
                >
                  Submit
                </button>

                {status && (
                  <div className="mt-3 text-sm text-neutral-200">{status}</div>
                )}
              </div>

              <div className="mt-4 text-xs text-neutral-400">
                Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from the main supply room.
              </div>
            </>
          )}

          {activeTab === "settings" && (
            <>
              <div className="text-lg font-semibold">Settings</div>

              <div className="mt-3 rounded-2xl bg-neutral-950/40 p-4">
                <div className="text-sm text-neutral-300 mb-2">Default location</div>

                {locationError ? (
                  <div className="text-sm text-red-300">{locationError}</div>
                ) : (
                  <select
                    value={currentLocationId}
                    onChange={(e) => handleChangeLocation(e.target.value)}
                    className="w-full rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-3"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-2 text-xs text-neutral-400">
                  This is saved on the device (so each iPad/phone can default to its room).
                </div>
              </div>
            </>
          )}

          {activeTab === "totals" && (
            <div className="text-sm text-neutral-300">
              Totals screen coming next (building totals / low stock list). Your transaction + alerts can still run now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-2xl px-4 py-3 font-semibold ${
        active ? "bg-white text-black" : "bg-neutral-900 text-white border border-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
