"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type LocationRow = { id: string; name: string };

type Tab = "TRANSACTION" | "TOTALS" | "SETTINGS";
type Mode = "USE" | "RESTOCK";

function clsx(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function safeJson<T = any>(v: any): T | null {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export default function ProtectedPage() {
  const [tab, setTab] = useState<Tab>("TRANSACTION");
  const [mode, setMode] = useState<Mode>("USE");

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationsError, setLocationsError] = useState<string>("");

  const [defaultLocationId, setDefaultLocationId] = useState<string>("");
  const [overrideMainOnce, setOverrideMainOnce] = useState<boolean>(false);

  const [itemQuery, setItemQuery] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const [status, setStatus] = useState<string>("");
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);

  const activeLocationId = useMemo(() => {
    if (overrideMainOnce) {
      // Try to pick a MAIN location by name if it exists
      const main = locations.find((l) => l.name.toLowerCase().includes("main"));
      return main?.id ?? defaultLocationId;
    }
    return defaultLocationId;
  }, [overrideMainOnce, locations, defaultLocationId]);

  const activeLocationName = useMemo(() => {
    const found = locations.find((l) => l.id === activeLocationId);
    return found?.name ?? "—";
  }, [locations, activeLocationId]);

  // Load saved default location
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("asc_default_location_id") : null;
    if (saved) setDefaultLocationId(saved);
  }, []);

  // Fetch locations
  useEffect(() => {
    (async () => {
      try {
        setLocationsError("");
        const res = await fetch("/api/storage-areas", { method: "GET" });
        const j = await res.json();

        if (!res.ok) {
          setLocations([]);
          setLocationsError(j?.error ?? "Failed to load locations");
          return;
        }

        const list: LocationRow[] = Array.isArray(j?.locations) ? j.locations : [];
        setLocations(list);

        // If no default is set, pick the first location
        if (!defaultLocationId && list.length) {
          setDefaultLocationId(list[0].id);
          localStorage.setItem("asc_default_location_id", list[0].id);
        }
      } catch (e: any) {
        setLocations([]);
        setLocationsError(e?.message ?? "Failed to load locations");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAndSaveDefaultLocation(id: string) {
    setDefaultLocationId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("asc_default_location_id", id);
    }
  }

  async function submitTransaction(queryOverride?: string) {
    const q = (queryOverride ?? itemQuery).trim();
    if (!q) {
      setStatus("❌ Enter an item name or barcode.");
      return;
    }
    if (!activeLocationId) {
      setStatus("❌ Choose a location first.");
      return;
    }

    setStatus("⏳ Submitting...");

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          itemQuery: q,
          qty,
          storageAreaId: activeLocationId,
        }),
      });

      const text = await res.text();
      const j = safeJson<any>(text);

      if (!res.ok) {
        if (j?.code === "ITEM_NOT_FOUND") {
          setStatus(`❌ Not in system: ${j?.scanned ?? q}`);
        } else {
          setStatus(`❌ Transaction failed: ${j?.error ?? res.statusText}`);
        }
        return;
      }

      setStatus("✅ Submitted");

      // one-time MAIN override is consumed after a successful submit
      if (overrideMainOnce) setOverrideMainOnce(false);

      // reset input
      setItemQuery("");
      setQty(1);
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Location:</div>
              <div className="text-sm font-semibold">{activeLocationName}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setTab("TRANSACTION")}
              className={clsx(
                "px-4 py-2 rounded-full border",
                tab === "TRANSACTION"
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 border-neutral-700"
              )}
            >
              Transaction
            </button>
            <button
              onClick={() => setTab("TOTALS")}
              className={clsx(
                "px-4 py-2 rounded-full border",
                tab === "TOTALS"
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 border-neutral-700"
              )}
            >
              Totals
            </button>
            <button
              onClick={() => setTab("SETTINGS")}
              className={clsx(
                "px-4 py-2 rounded-full border",
                tab === "SETTINGS"
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 border-neutral-700"
              )}
            >
              Settings
            </button>
          </div>
        </div>

        {/* TRANSACTION TAB */}
        {tab === "TRANSACTION" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5 space-y-4">
            {/* One-time override */}
            <div className="rounded-2xl bg-neutral-950/50 border border-neutral-800 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">One-time override</div>
                <div className="text-sm text-neutral-300">
                  Grabbed it from MAIN supply room? Tap this once.
                </div>
              </div>
              <button
                onClick={() => setOverrideMainOnce((v) => !v)}
                className={clsx(
                  "w-24 h-20 rounded-2xl border flex flex-col items-center justify-center",
                  overrideMainOnce
                    ? "bg-yellow-400/20 border-yellow-400 text-yellow-200"
                    : "bg-neutral-900 border-neutral-700"
                )}
              >
                <div className="text-xl">⚡</div>
                <div className="font-semibold">MAIN</div>
                <div className="text-xs">(1x)</div>
              </button>
            </div>

            {/* Mode */}
            <div className="rounded-2xl bg-neutral-950/50 border border-neutral-800 p-4 space-y-3">
              <div className="font-semibold">Mode</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setMode("USE")}
                  className={clsx(
                    "flex-1 py-4 rounded-2xl font-bold border",
                    mode === "USE"
                      ? "bg-red-600 border-red-600"
                      : "bg-neutral-900 border-neutral-700"
                  )}
                >
                  USE
                </button>
                <button
                  onClick={() => setMode("RESTOCK")}
                  className={clsx(
                    "flex-1 py-4 rounded-2xl font-bold border",
                    mode === "RESTOCK"
                      ? "bg-green-600 border-green-600"
                      : "bg-neutral-900 border-neutral-700"
                  )}
                >
                  RESTOCK
                </button>
              </div>

              {/* Item + camera */}
              <div className="flex gap-3 items-center">
                <input
                  className="flex-1 rounded-2xl bg-white text-black px-4 py-4"
                  placeholder="Scan barcode or type item"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitTransaction();
                  }}
                />

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center"
                  aria-label="Open scanner"
                >
                  📷
                </button>
              </div>

              {/* Qty */}
              <input
                className="w-full rounded-2xl bg-white text-black px-4 py-4"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              />

              {/* Submit */}
              <button
                onClick={() => submitTransaction()}
                className="w-full py-4 rounded-2xl bg-black border border-neutral-700 font-bold text-lg"
              >
                Submit
              </button>

              {/* Status + errors */}
              {locationsError ? (
                <div className="text-yellow-300 font-semibold">
                  Locations error: {locationsError}
                </div>
              ) : null}

              {status ? <div className="text-neutral-200">{status}</div> : null}

              <div className="text-xs text-neutral-400 pt-2">
                Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from supply.
              </div>
            </div>

            {/* Scanner modal */}
            {scannerOpen && (
              <ScannerModal
                onClose={() => setScannerOpen(false)}
                onScan={(code) => {
                  setScannerOpen(false);
                  setItemQuery(code);
                  // auto-submit immediately
                  submitTransaction(code);
                }}
              />
            )}
          </div>
        )}

        {/* TOTALS TAB */}
        {tab === "TOTALS" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5">
            <div className="text-lg font-semibold">Totals</div>
            <div className="text-sm text-neutral-300 mt-1">
              (We can wire this to building totals next.)
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "SETTINGS" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5 space-y-3">
            <div className="text-lg font-semibold">Settings</div>

            <div className="text-sm text-neutral-300">
              Default location for this device:
            </div>

            <select
              className="w-full rounded-2xl bg-neutral-950 border border-neutral-700 px-4 py-3"
              value={defaultLocationId}
              onChange={(e) => setAndSaveDefaultLocation(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <div className="text-xs text-neutral-400">
              This saves to your device (so each iPad/iPhone can default to its room).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ScannerModal:
 * - Uses BarcodeDetector when available
 * - If not available, lets you paste/type a barcode and submit
 */
function ScannerModal(props: { onClose: () => void; onScan: (code: string) => void }) {
  const { onClose, onScan } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string>("");
  const [manual, setManual] = useState<string>("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      setError("");

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const hasDetector = typeof (window as any).BarcodeDetector !== "undefined";
        if (!hasDetector) {
          setError("BarcodeDetector not supported on this device/browser. Use manual entry below.");
          return;
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
        });

        const scanLoop = async () => {
          if (stopped) return;
          try {
            if (videoRef.current) {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length) {
                const raw = (barcodes[0].rawValue ?? "").trim();
                if (raw) {
                  onScan(raw);
                  return;
                }
              }
            }
          } catch {
            // ignore and keep scanning
          }
          raf = requestAnimationFrame(scanLoop);
        };

        raf = requestAnimationFrame(scanLoop);
      } catch (e: any) {
        setError(e?.message ?? "Could not access camera");
      }
    }

    start();

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-xl rounded-3xl bg-neutral-950 border border-neutral-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Scan Barcode</div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-xl bg-neutral-800 border border-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-neutral-700 bg-black">
          <video ref={videoRef} className="w-full h-64 object-cover" />
        </div>

        {error ? <div className="text-yellow-300 text-sm">{error}</div> : null}

        <div className="text-sm text-neutral-300">Manual entry (if needed):</div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Type/paste barcode"
          />
          <button
            onClick={() => {
              const code = manual.trim();
              if (code) onScan(code);
            }}
            className="px-4 py-3 rounded-2xl bg-white text-black font-bold"
          >
            Use
          </button>
        </div>
      </div>
    </div>
  );
}
