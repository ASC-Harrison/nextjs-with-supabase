"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type StorageArea = {
  id: string;
  name: string;
};

type TxMode = "USE" | "RESTOCK";

type ApiResult =
  | { ok: true; message?: string }
  | { ok: false; code?: string; error?: string; scanned?: string };

const LS_LOCATION_ID = "asc_location_id";
const LS_LOCATION_LOCKED = "asc_location_locked";

export default function ProtectedPage() {
  // ---------- Tabs ----------
  const [tab, setTab] = useState<"transaction" | "totals" | "settings">("transaction");

  // ---------- Locations ----------
  const [locations, setLocations] = useState<StorageArea[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError] = useState<string>("");

  const [locationId, setLocationId] = useState<string>("");
  const [locationLocked, setLocationLocked] = useState<boolean>(false);

  const currentLocation = useMemo(
    () => locations.find((l) => l.id === locationId) || null,
    [locations, locationId]
  );

  // ---------- Transaction ----------
  const [mode, setMode] = useState<TxMode>("USE");
  const [overrideMainOnce, setOverrideMainOnce] = useState(false);

  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);

  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // ---------- Scanner ----------
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // ---------- Load saved location + lock ----------
  useEffect(() => {
    const savedLoc = localStorage.getItem(LS_LOCATION_ID) || "";
    const savedLocked = localStorage.getItem(LS_LOCATION_LOCKED) === "true";
    setLocationId(savedLoc);
    setLocationLocked(savedLocked);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_LOCATION_ID, locationId || "");
  }, [locationId]);

  useEffect(() => {
    localStorage.setItem(LS_LOCATION_LOCKED, locationLocked ? "true" : "false");
  }, [locationLocked]);

  // ---------- Fetch locations ----------
  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      setLocLoading(true);
      setLocError("");
      try {
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { locations?: StorageArea[] };

        const list = Array.isArray(data.locations) ? data.locations : [];
        if (!cancelled) {
          setLocations(list);

          // If no saved location, pick first
          if (!locationId && list.length > 0) {
            setLocationId(list[0].id);
          }
        }
      } catch (e: any) {
        if (!cancelled) setLocError(`Failed to load locations.`);
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    }

    loadLocations();
    return () => {
      cancelled = true;
    };
    // NOTE: do NOT include locationId as dependency, we only want initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Helpers ----------
  function clampQty(n: number) {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(9999, Math.floor(n)));
  }

  function resetAfterSubmit() {
    setItemQuery("");
    setQty(1);
    if (overrideMainOnce) setOverrideMainOnce(false);
  }

  // ---------- Submit ----------
  async function submitTransaction(autoFromScan = false) {
    setStatus("");
    setScannerError("");

    const trimmed = itemQuery.trim();
    if (!trimmed) {
      setStatus("❌ Enter an item name or scan a barcode.");
      return;
    }
    if (!locationId) {
      setStatus("❌ Pick a location first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          locationId,
          qty: clampQty(qty),
          query: trimmed, // could be barcode or name
          overrideMainOnce,
          source: autoFromScan ? "scan" : "manual",
        }),
      });

      let json: ApiResult | any = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        const code = json?.code;
        const err = json?.error || res.statusText;

        // If your API uses ITEM_NOT_FOUND, show that message
        if (code === "ITEM_NOT_FOUND") {
          setStatus(`❌ Not in system: ${json?.scanned || trimmed}`);
        } else {
          setStatus(`❌ Transaction failed: ${err}`);
        }
        return;
      }

      // success
      setStatus("✅ Submitted!");
      resetAfterSubmit();
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Scanner open/close ----------
  async function openScanner() {
    setScannerError("");
    setStatus("");

    // BarcodeDetector required (no extra packages)
    const hasBD = typeof window !== "undefined" && "BarcodeDetector" in window;
    if (!hasBD) {
      setScannerError("Scanner not supported on this device/browser. Type the barcode instead.");
      return;
    }

    setScannerOpen(true);
  }

  async function closeScanner() {
    setScannerOpen(false);
    stopCamera();
  }

  function stopCamera() {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // ---------- Start camera when modal opens ----------
  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
        });

        const loop = async () => {
          try {
            const v = videoRef.current;
            if (!v) return;

            const codes = await detector.detect(v);
            if (codes && codes.length > 0) {
              const raw = codes[0]?.rawValue || "";
              if (raw) {
                // Put result into input + auto-submit
                setItemQuery(raw);
                await closeScanner();
                // auto submit
                setTimeout(() => submitTransaction(true), 50);
                return;
              }
            }
          } catch {
            // ignore detect errors
          }
          scanLoopRef.current = requestAnimationFrame(loop);
        };

        scanLoopRef.current = requestAnimationFrame(loop);
      } catch (e: any) {
        setScannerError("Could not access camera. Check permissions in Safari settings.");
        setScannerOpen(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        {/* Header card */}
        <div className="rounded-3xl bg-neutral-900/80 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-extrabold leading-tight">Baxter ASC</div>
              <div className="text-3xl font-extrabold leading-tight">Inventory</div>
              <div className="mt-2 text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-neutral-400">Location:</div>
              <div className="mt-1 text-sm font-semibold">
                {locLoading ? "Loading…" : currentLocation?.name || "—"}
              </div>

              <button
                className={`mt-3 inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ${
                  locationLocked ? "bg-neutral-800" : "bg-neutral-700 hover:bg-neutral-600"
                }`}
                onClick={() => setLocationLocked((v) => !v)}
                type="button"
                title="Lock location so it can’t be changed accidentally"
              >
                <span>{locationLocked ? "🔒 Locked" : "🔓 Unlocked"}</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-3">
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

        {/* Body */}
        <div className="mt-6">
          {tab === "transaction" && (
            <div className="rounded-3xl bg-neutral-900/80 p-5 shadow">
              {/* Location selector */}
              <div className="mb-4">
                <div className="mb-2 text-sm font-semibold text-neutral-200">Select location</div>

                <select
                  className="w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm outline-none ring-1 ring-neutral-800 focus:ring-2 focus:ring-neutral-600"
                  value={locationId}
                  disabled={locationLocked || locLoading}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                {locError ? (
                  <div className="mt-3 rounded-2xl bg-yellow-900/30 px-4 py-3 text-sm text-yellow-200 ring-1 ring-yellow-700/40">
                    Locations error: {locError}
                  </div>
                ) : null}
              </div>

              {/* One-time override */}
              <div className="mb-5 flex items-center justify-between gap-4 rounded-3xl bg-neutral-950/60 p-4 ring-1 ring-neutral-800">
                <div>
                  <div className="text-lg font-bold">One-time override</div>
                  <div className="text-sm text-neutral-300">
                    Grabbed it from MAIN supply room? Tap this once.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOverrideMainOnce((v) => !v)}
                  className={`rounded-3xl px-5 py-4 text-sm font-extrabold shadow ring-1 ${
                    overrideMainOnce
                      ? "bg-neutral-200 text-black ring-neutral-300"
                      : "bg-neutral-900 text-white ring-neutral-700 hover:bg-neutral-800"
                  }`}
                >
                  ⚡ MAIN
                  <div className="text-xs font-semibold opacity-80">(1x)</div>
                </button>
              </div>

              {/* Mode */}
              <div className="mb-5 rounded-3xl bg-neutral-950/60 p-4 ring-1 ring-neutral-800">
                <div className="mb-3 text-lg font-bold">Mode</div>
                <div className="flex gap-3">
                  <ModeButton active={mode === "USE"} onClick={() => setMode("USE")}>
                    USE
                  </ModeButton>
                  <ModeButton active={mode === "RESTOCK"} onClick={() => setMode("RESTOCK")}>
                    RESTOCK
                  </ModeButton>
                </div>
              </div>

              {/* Item input + camera button INLINE */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-2xl bg-white px-4 py-4 text-base text-black outline-none"
                    placeholder="Scan barcode or type item"
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitTransaction(false);
                    }}
                  />

                  <button
                    type="button"
                    onClick={openScanner}
                    className="w-16 shrink-0 rounded-2xl bg-neutral-900 text-white ring-1 ring-neutral-700 hover:bg-neutral-800"
                    title="Open camera scanner"
                  >
                    📷
                  </button>
                </div>
              </div>

              {/* Qty with quick arrows */}
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-14 w-14 rounded-2xl bg-neutral-900 text-2xl font-black ring-1 ring-neutral-700 hover:bg-neutral-800"
                    onClick={() => setQty((q) => clampQty(q - 1))}
                  >
                    −
                  </button>

                  <input
                    className="flex-1 rounded-2xl bg-white px-4 py-4 text-base text-black outline-none"
                    value={String(qty)}
                    inputMode="numeric"
                    onChange={(e) => setQty(clampQty(Number(e.target.value || 1)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitTransaction(false);
                    }}
                  />

                  <button
                    type="button"
                    className="h-14 w-14 rounded-2xl bg-neutral-900 text-2xl font-black ring-1 ring-neutral-700 hover:bg-neutral-800"
                    onClick={() => setQty((q) => clampQty(q + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitTransaction(false)}
                className="w-full rounded-3xl bg-black py-5 text-xl font-extrabold ring-1 ring-neutral-800 hover:bg-neutral-950 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>

              {/* Status */}
              {status ? (
                <div className="mt-4 rounded-2xl bg-neutral-950/60 px-4 py-3 text-sm text-neutral-200 ring-1 ring-neutral-800">
                  {status}
                </div>
              ) : null}

              <div className="mt-5 text-sm text-neutral-400">
                Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from supply.
              </div>
            </div>
          )}

          {tab === "totals" && (
            <div className="rounded-3xl bg-neutral-900/80 p-5 shadow">
              <div className="text-xl font-extrabold">Totals</div>
              <div className="mt-2 text-sm text-neutral-300">
                (This tab can stay as-is for now — we’ll wire totals once transactions are stable.)
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="rounded-3xl bg-neutral-900/80 p-5 shadow">
              <div className="text-xl font-extrabold">Settings</div>
              <div className="mt-2 text-sm text-neutral-300">
                (We’ll put your admin tools / adding unknown items here.)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-neutral-950 p-4 ring-1 ring-neutral-800">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold">Scan barcode</div>
              <button
                type="button"
                onClick={closeScanner}
                className="rounded-2xl bg-neutral-900 px-3 py-2 text-sm font-bold ring-1 ring-neutral-700 hover:bg-neutral-800"
              >
                Close
              </button>
            </div>

            {scannerError ? (
              <div className="mt-3 rounded-2xl bg-yellow-900/30 px-4 py-3 text-sm text-yellow-200 ring-1 ring-yellow-700/40">
                {scannerError}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-neutral-800">
              <video ref={videoRef} className="h-72 w-full bg-black object-cover" muted playsInline />
            </div>

            <div className="mt-3 text-xs text-neutral-400">
              Point the camera at the barcode. It will auto-submit when detected.
            </div>
          </div>
        </div>
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
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 text-sm font-extrabold ring-1 ${
        active
          ? "bg-white text-black ring-white"
          : "bg-neutral-950/60 text-white ring-neutral-800 hover:bg-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function ModeButton({
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
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl py-4 text-lg font-extrabold ring-1 ${
        active
          ? "bg-red-600 text-white ring-red-400/50"
          : "bg-neutral-900 text-white ring-neutral-700 hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
