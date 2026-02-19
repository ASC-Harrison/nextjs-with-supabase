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

function promptPin(message: string): string | null {
  // iOS-friendly simple prompt
  const v = window.prompt(message);
  if (!v) return null;
  return v.trim();
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

  // Lock-to-location (PIN)
  const [locLockEnabled, setLocLockEnabled] = useState<boolean>(false);
  const [hasLocPin, setHasLocPin] = useState<boolean>(false);

  // Load saved settings
  useEffect(() => {
    const savedLoc = localStorage.getItem("asc_default_location_id");
    if (savedLoc) setDefaultLocationId(savedLoc);

    const lockEnabled = localStorage.getItem("asc_loc_lock_enabled") === "1";
    setLocLockEnabled(lockEnabled);

    const pin = localStorage.getItem("asc_loc_lock_pin");
    setHasLocPin(!!pin);
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

        // Pick a default if none
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

  const activeLocationId = useMemo(() => {
    if (overrideMainOnce) {
      const main = locations.find((l) => l.name.toLowerCase().includes("main"));
      return main?.id ?? defaultLocationId;
    }
    return defaultLocationId;
  }, [overrideMainOnce, locations, defaultLocationId]);

  const activeLocationName = useMemo(() => {
    const found = locations.find((l) => l.id === activeLocationId);
    return found?.name ?? "—";
  }, [locations, activeLocationId]);

  function tryChangeDefaultLocation(nextId: string) {
    // If lock enabled, require PIN
    if (locLockEnabled) {
      const stored = localStorage.getItem("asc_loc_lock_pin") ?? "";
      const entered = promptPin("Enter location PIN to change location:");
      if (!entered || entered !== stored) {
        setStatus("🔒 Location is locked (PIN required).");
        return;
      }
    }

    setDefaultLocationId(nextId);
    localStorage.setItem("asc_default_location_id", nextId);
    setStatus("✅ Location updated.");
  }

  function enableLock() {
    const existing = localStorage.getItem("asc_loc_lock_pin");
    if (!existing) {
      const p = promptPin("Create a 4+ digit PIN for location lock:");
      if (!p || p.length < 4) {
        setStatus("❌ PIN must be at least 4 digits.");
        return;
      }
      localStorage.setItem("asc_loc_lock_pin", p);
      setHasLocPin(true);
    }
    localStorage.setItem("asc_loc_lock_enabled", "1");
    setLocLockEnabled(true);
    setStatus("🔒 Location lock enabled.");
  }

  function disableLock() {
    const stored = localStorage.getItem("asc_loc_lock_pin") ?? "";
    if (stored) {
      const entered = promptPin("Enter PIN to disable location lock:");
      if (!entered || entered !== stored) {
        setStatus("❌ Wrong PIN.");
        return;
      }
    }
    localStorage.setItem("asc_loc_lock_enabled", "0");
    setLocLockEnabled(false);
    setStatus("🔓 Location lock disabled.");
  }

  function changePin() {
    const stored = localStorage.getItem("asc_loc_lock_pin") ?? "";
    if (stored) {
      const entered = promptPin("Enter current PIN:");
      if (!entered || entered !== stored) {
        setStatus("❌ Wrong PIN.");
        return;
      }
    }
    const next = promptPin("Enter new PIN (4+ digits):");
    if (!next || next.length < 4) {
      setStatus("❌ PIN must be at least 4 digits.");
      return;
    }
    localStorage.setItem("asc_loc_lock_pin", next);
    setHasLocPin(true);
    setStatus("✅ PIN updated.");
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

      if (overrideMainOnce) setOverrideMainOnce(false);
      setItemQuery("");
      setQty(1);
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Center everything */}
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
        {/* Header */}
        <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-extrabold leading-tight">Baxter ASC</div>
              <div className="text-3xl font-extrabold leading-tight -mt-1">Inventory</div>
              <div className="text-sm text-neutral-300 mt-1">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Location:</div>
              <div className="text-sm font-semibold leading-tight">{activeLocationName}</div>
              <div className="mt-1 text-xs text-neutral-400">
                {locLockEnabled ? "🔒 locked" : "🔓 unlocked"}
              </div>
            </div>
          </div>

          {/* Tabs (pill style like before) */}
          <div className="mt-4 flex gap-3">
            <TabBtn active={tab === "TRANSACTION"} onClick={() => setTab("TRANSACTION")}>
              Transaction
            </TabBtn>
            <TabBtn active={tab === "TOTALS"} onClick={() => setTab("TOTALS")}>
              Totals
            </TabBtn>
            <TabBtn active={tab === "SETTINGS"} onClick={() => setTab("SETTINGS")}>
              Settings
            </TabBtn>
          </div>
        </div>

        {/* TRANSACTION */}
        {tab === "TRANSACTION" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5 space-y-4">
            {/* Override */}
            <div className="rounded-2xl bg-neutral-950/50 border border-neutral-800 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-lg">One-time override</div>
                <div className="text-sm text-neutral-300">
                  Grabbed it from MAIN supply room? Tap this once.
                </div>
              </div>

              <button
                onClick={() => setOverrideMainOnce((v) => !v)}
                className={clsx(
                  "w-24 h-20 rounded-2xl border flex flex-col items-center justify-center",
                  overrideMainOnce
                    ? "bg-yellow-400/15 border-yellow-400 text-yellow-200"
                    : "bg-neutral-900 border-neutral-700"
                )}
              >
                <div className="text-xl">⚡</div>
                <div className="font-semibold">MAIN</div>
                <div className="text-xs">(1x)</div>
              </button>
            </div>

            {/* Mode + camera next to RESTOCK */}
            <div className="rounded-2xl bg-neutral-950/50 border border-neutral-800 p-4 space-y-3">
              <div className="font-semibold text-lg">Mode</div>

              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setMode("USE")}
                  className={clsx(
                    "flex-1 py-4 rounded-2xl font-extrabold border text-lg",
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
                    "flex-1 py-4 rounded-2xl font-extrabold border text-lg",
                    mode === "RESTOCK"
                      ? "bg-green-600 border-green-600"
                      : "bg-neutral-900 border-neutral-700"
                  )}
                >
                  RESTOCK
                </button>

                {/* camera button beside restock (NOT floating) */}
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center"
                  aria-label="Open scanner"
                >
                  📷
                </button>
              </div>

              {/* Item input */}
              <input
                className="w-full rounded-2xl bg-white text-black px-4 py-4 text-lg"
                placeholder="Scan barcode or type item"
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitTransaction();
                }}
              />

              {/* Qty */}
              <input
                className="w-full rounded-2xl bg-white text-black px-4 py-4 text-lg"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              />

              {/* Submit */}
              <button
                onClick={() => submitTransaction()}
                className="w-full py-5 rounded-2xl bg-black border border-neutral-700 font-extrabold text-xl"
              >
                Submit
              </button>

              {/* Errors */}
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

            {scannerOpen && (
              <ScannerModal
                onClose={() => setScannerOpen(false)}
                onScan={(code) => {
                  setScannerOpen(false);
                  setItemQuery(code);
                  submitTransaction(code);
                }}
              />
            )}
          </div>
        )}

        {/* TOTALS */}
        {tab === "TOTALS" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5">
            <div className="text-lg font-semibold">Totals</div>
            <div className="text-sm text-neutral-300 mt-1">
              (We can wire this to building totals next.)
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "SETTINGS" && (
          <div className="rounded-3xl bg-neutral-900/70 border border-neutral-800 p-5 space-y-4">
            <div className="text-lg font-semibold">Settings</div>

            <div className="space-y-2">
              <div className="text-sm text-neutral-300">Default location for this device</div>

              <select
                className={clsx(
                  "w-full rounded-2xl bg-neutral-950 border border-neutral-700 px-4 py-4 text-white",
                  locLockEnabled ? "opacity-80" : ""
                )}
                value={defaultLocationId}
                onChange={(e) => tryChangeDefaultLocation(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <div className="text-xs text-neutral-400">
                This saves per-device (so each phone/iPad can default to its room).
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-950/50 border border-neutral-800 p-4 space-y-3">
              <div className="font-semibold">Lock location changes</div>

              <div className="flex gap-2">
                {!locLockEnabled ? (
                  <button
                    onClick={enableLock}
                    className="flex-1 py-3 rounded-2xl bg-white text-black font-bold"
                  >
                    Enable Lock
                  </button>
                ) : (
                  <button
                    onClick={disableLock}
                    className="flex-1 py-3 rounded-2xl bg-white text-black font-bold"
                  >
                    Disable Lock
                  </button>
                )}

                <button
                  onClick={changePin}
                  className="flex-1 py-3 rounded-2xl bg-neutral-900 border border-neutral-700 font-bold"
                >
                  Change PIN
                </button>
              </div>

              <div className="text-xs text-neutral-400">
                {hasLocPin
                  ? "PIN is set. When lock is enabled, changing location requires PIN."
                  : "No PIN set yet. Enabling lock will ask you to create one."}
              </div>
            </div>

            {status ? <div className="text-neutral-200">{status}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={clsx(
        "flex-1 py-3 rounded-full border text-base font-semibold",
        props.active ? "bg-white text-black border-white" : "bg-neutral-900 border-neutral-700"
      )}
    >
      {props.children}
    </button>
  );
}

/**
 * ScannerModal:
 * - Uses BarcodeDetector when available
 * - Fallback: manual entry
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
          setError("Scanner not supported here. Use manual entry below.");
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
            // keep scanning
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
      <div className="w-full max-w-md rounded-3xl bg-neutral-950 border border-neutral-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Scan Barcode</div>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700"
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
