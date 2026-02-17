"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type TxMode = "USE" | "RESTOCK";
type Tab = "transaction" | "totals" | "settings";

type TxOk = {
  ok: true;
  message?: string;
  // optional payloads your API might return
  item?: any;
  inventory?: any;
};

type TxErr = {
  ok: false;
  code?: "ITEM_NOT_FOUND" | string;
  error?: string;
  scanned?: string;
};

type TxResponse = TxOk | TxErr;

type LocationRow = {
  id: string;
  name: string;
};

function safeJson<T>(raw: any): T | null {
  if (!raw) return null;
  return raw as T;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<{ res: Response; data: T | null }> {
  const res = await fetch(input, init);
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { res, data };
}

export default function ProtectedPage() {
  const [tab, setTab] = useState<Tab>("transaction");

  // Transaction state
  const [mode, setMode] = useState<TxMode>("USE");
  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("");

  // Locations
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [locationsError, setLocationsError] = useState<string>("");

  // One-time override for MAIN
  const [overrideMainOnce, setOverrideMainOnce] = useState(false);

  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false);

  // Load locations (tries /api/locations first; if you don’t have it, it won’t break the build)
  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      setLocationsError("");
      // If you already have a locations endpoint, great:
      const { res, data } = await fetchJson<{ ok: boolean; locations?: LocationRow[]; error?: string }>("/api/locations");

      if (cancelled) return;

      if (res.ok && data?.ok && Array.isArray(data.locations)) {
        setLocations(data.locations);
        // pick first default if none
        if (!locationId && data.locations[0]?.id) setLocationId(data.locations[0].id);
        return;
      }

      // If /api/locations doesn't exist or fails, we don't crash the UI
      // You can remove this fallback later once /api/locations exists.
      setLocations([]);
      setLocationId("");
      setLocationsError(
        data?.error ||
          (res.status === 404
            ? "Locations API not found (/api/locations). App still works, but dropdown will be empty."
            : "Failed to load locations.")
      );
    }

    loadLocations();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLocationName = useMemo(() => {
    const found = locations.find((l) => l.id === locationId);
    return found?.name || "—";
  }, [locations, locationId]);

  async function submitTransaction() {
    setStatus("");

    const cleaned = itemQuery.trim();
    if (!cleaned) {
      setStatus("❌ Enter an item name or barcode.");
      return;
    }
    if (!qty || qty <= 0) {
      setStatus("❌ Quantity must be 1 or more.");
      return;
    }

    // Payload expected by your API (adjust if needed)
    const payload = {
      itemQuery: cleaned, // name OR barcode
      qty: Number(qty),
      action: mode, // "USE" or "RESTOCK"
      locationId: locationId || null,
      overrideMainOnce: overrideMainOnce || false,
    };

    const { res, data } = await fetchJson<TxResponse>("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // consume override once
    if (overrideMainOnce) setOverrideMainOnce(false);

    // Handle errors cleanly (NO "json" variable problems)
    if (!res.ok || !data) {
      setStatus(`❌ Transaction failed: ${res.status} ${res.statusText}`);
      return;
    }

    if (data.ok === false) {
      if (data.code === "ITEM_NOT_FOUND") {
        setStatus(`❌ Not in system: ${data.scanned || cleaned}`);
        return;
      }
      setStatus(`❌ Transaction failed: ${data.error || "Unknown error"}`);
      return;
    }

    // Success
    setStatus(`✅ Submitted${data.message ? `: ${data.message}` : ""}`);
    setItemQuery("");
    setQty(1);
  }

  function onScanned(value: string) {
    // Put scanned value into the input
    setItemQuery(value);
    setScannerOpen(false);
    // Optional: auto-submit after scan (comment out if you don’t want)
    // submitTransaction();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/70 p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-neutral-800 flex items-center justify-center">
              {/* Put your in-app header logo file in /public/asc-header-logo.png */}
              <Image src="/asc-header-logo.png" alt="ASC" width={56} height={56} priority />
            </div>

            <div className="flex-1">
              <div className="text-xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">Cabinet tracking + building totals + low stock alerts</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Location:</div>
              <div className="text-sm font-semibold">{currentLocationName}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
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
        <div className="mt-4 rounded-2xl bg-neutral-900/70 p-4 shadow">
          {tab === "transaction" && (
            <>
              {/* One-time override */}
              <div className="rounded-2xl bg-neutral-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">One-time override</div>
                    <div className="text-sm text-neutral-300">Use MAIN (1x) if you grabbed it from supply room.</div>
                  </div>
                  <button
                    onClick={() => setOverrideMainOnce(true)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow ${
                      overrideMainOnce ? "bg-yellow-500 text-black" : "bg-neutral-800 text-white"
                    }`}
                  >
                    ⚡ MAIN (1x)
                  </button>
                </div>
              </div>

              {/* Mode */}
              <div className="mt-4 rounded-2xl bg-neutral-950/60 p-4">
                <div className="text-base font-semibold mb-3">Mode</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("USE")}
                    className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                      mode === "USE" ? "bg-red-600 text-white" : "bg-neutral-800 text-white"
                    }`}
                  >
                    USE
                  </button>
                  <button
                    onClick={() => setMode("RESTOCK")}
                    className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                      mode === "RESTOCK" ? "bg-green-600 text-white" : "bg-neutral-800 text-white"
                    }`}
                  >
                    RESTOCK
                  </button>
                </div>

                {/* Scanner + inputs */}
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                      placeholder="Item name or barcode"
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                    />
                    <button
                      onClick={() => setScannerOpen(true)}
                      className="rounded-2xl bg-neutral-800 px-4 py-3 font-semibold"
                      title="Scan barcode"
                    >
                      📷
                    </button>
                  </div>

                  <input
                    className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />

                  <button onClick={submitTransaction} className="w-full rounded-2xl bg-black py-4 text-lg font-bold">
                    Submit
                  </button>

                  {status ? <div className="text-sm text-neutral-200">{status}</div> : null}

                  {locationsError ? (
                    <div className="text-sm text-yellow-300">Failed to load locations: {locationsError}</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 text-xs text-neutral-400">
                Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from the supply room.
              </div>
            </>
          )}

          {tab === "totals" && (
            <div className="rounded-2xl bg-neutral-950/60 p-4">
              <div className="text-lg font-bold">Totals</div>
              <div className="mt-2 text-sm text-neutral-300">
                (Placeholder) If you already have a totals view/API, tell me what it is and I’ll wire it in.
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="rounded-2xl bg-neutral-950/60 p-4 space-y-3">
              <div className="text-lg font-bold">Settings</div>

              <div>
                <div className="text-sm text-neutral-300 mb-1">Default Location</div>
                <select
                  className="w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={locations.length === 0}
                >
                  {locations.length === 0 ? (
                    <option value="">No locations loaded</option>
                  ) : (
                    locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="text-sm text-neutral-400">
                If your location dropdown is empty, you probably need a `/api/locations` route (or tell me how you store
                locations and I’ll wire it to Supabase).
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {scannerOpen && (
        <ScannerModal
          onClose={() => setScannerOpen(false)}
          onDetected={(val) => {
            if (val) onScanned(val);
          }}
        />
      )}
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
      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-semibold ${
        active ? "bg-white text-black" : "bg-neutral-800 text-white"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Scanner modal using the native BarcodeDetector API when available.
 * No extra libraries needed. If unsupported, it tells you instead of breaking.
 */
function ScannerModal({ onClose, onDetected }: { onClose: () => void; onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setErr("");

      // @ts-ignore
      const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
      if (!hasDetector) {
        setErr("Barcode scanning not supported on this browser/device. Use manual entry or a scanner that types into the field.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) return;

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // @ts-ignore
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
        });

        const tick = async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0]?.rawValue;
              if (raw) {
                onDetected(raw);
                return;
              }
            }
          } catch {
            // ignore detect errors and keep trying
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setErr(e?.message || "Camera permission denied or camera not available.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900 p-4 shadow">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">Scan Barcode</div>
          <button onClick={onClose} className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold">
            Close
          </button>
        </div>

        <div className="mt-3 rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-72 object-cover" playsInline muted />
        </div>

        {err ? <div className="mt-3 text-sm text-yellow-300">{err}</div> : <div className="mt-3 text-sm text-neutral-300">Point the camera at the barcode…</div>}
      </div>
    </div>
  );
}
