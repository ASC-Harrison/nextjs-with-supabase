"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TabKey = "transaction" | "totals" | "settings";

type LocationRow = { id: string; name: string };

type TxMode = "USE" | "RESTOCK";

type TxResponseOk = {
  ok: true;
  item?: { id: string; name: string; barcode?: string | null };
  location?: { id: string; name: string };
  new_on_hand?: number | null;
  message?: string;
};

type TxResponseErr = {
  ok: false;
  code?: string; // e.g. "ITEM_NOT_FOUND"
  error?: string;
  scanned?: string;
};

async function fetchLocations(): Promise<LocationRow[]> {
  const res = await fetch("/api/locations", { cache: "no-store" });
  const data: any = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to load locations");
  }
  if (!data?.ok || !Array.isArray(data.locations)) {
    throw new Error("Bad response from /api/locations");
  }
  return data.locations as LocationRow[];
}

async function postTransaction(payload: {
  mode: TxMode;
  itemQuery: string; // barcode or name
  qty: number;
  locationId: string;
  overrideMainOnce: boolean;
}): Promise<TxResponseOk | TxResponseErr> {
  const res = await fetch("/api/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data: any = await res.json().catch(() => null);

  // Always return a safe object shape
  if (!res.ok) {
    return {
      ok: false,
      code: data?.code,
      error: data?.error || res.statusText || "Transaction failed",
      scanned: data?.scanned,
    };
  }

  if (data?.ok === true) return data as TxResponseOk;

  return {
    ok: false,
    code: data?.code,
    error: data?.error || "Transaction failed",
    scanned: data?.scanned,
  };
}

/**
 * Camera scanning:
 * - Uses native BarcodeDetector if available (works on many Android/desktop; iOS support varies).
 * - If not available, it will tell you and you can still use a hardware scanner (best).
 */
async function scanWithCameraOnce(): Promise<string> {
  // @ts-ignore
  const BarcodeDetectorCtor = (window as any).BarcodeDetector as
    | undefined
    | (new (opts: any) => {
        detect: (img: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      });

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera not available in this browser.");
  }
  if (!BarcodeDetectorCtor) {
    throw new Error("Camera barcode scan not supported here. Use a scanner or type the barcode.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;

    await video.play();

    const detector = new BarcodeDetectorCtor({
      formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"],
    });

    // Wait up to ~5 seconds scanning frames
    const started = Date.now();
    while (Date.now() - started < 5000) {
      // Create bitmap from video frame
      const bitmap = await createImageBitmap(video);
      const results = await detector.detect(bitmap);
      bitmap.close?.();

      const value = results?.[0]?.rawValue?.trim();
      if (value) return value;

      // small delay
      await new Promise((r) => setTimeout(r, 120));
    }

    throw new Error("No barcode detected. Try again or use the scanner.");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export default function ProtectedPage() {
  const [tab, setTab] = useState<TabKey>("transaction");

  // Locations
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationsError, setLocationsError] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");

  // Transaction
  const [mode, setMode] = useState<TxMode>("USE");
  const [itemQuery, setItemQuery] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const [overrideMainOnce, setOverrideMainOnce] = useState<boolean>(false);
  const [autoSubmit, setAutoSubmit] = useState<boolean>(true);

  const [busy, setBusy] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load locations on first render
  useEffect(() => {
    (async () => {
      try {
        setLocationsError("");
        const list = await fetchLocations();
        setLocations(list);

        // If nothing selected yet, choose first location
        if (!locationId && list.length) setLocationId(list[0].id);
      } catch (e: any) {
        setLocations([]);
        setLocationsError(e?.message ?? "Failed to load locations");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLocationName = useMemo(() => {
    const found = locations.find((l) => l.id === locationId);
    return found?.name ?? "—";
  }, [locations, locationId]);

  async function submit() {
    const trimmed = itemQuery.trim();
    if (!trimmed) {
      setStatus("Enter or scan an item name/barcode.");
      inputRef.current?.focus();
      return;
    }
    if (!locationId) {
      setStatus("Pick a location first.");
      return;
    }
    if (!qty || qty <= 0) {
      setStatus("Qty must be 1 or more.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const res = await postTransaction({
        mode,
        itemQuery: trimmed,
        qty: Number(qty),
        locationId,
        overrideMainOnce,
      });

      if (res.ok) {
        setStatus(`✅ ${mode} saved${res.new_on_hand != null ? ` • New on-hand: ${res.new_on_hand}` : ""}`);
        setItemQuery("");
        setQty(1);
        setOverrideMainOnce(false);
        inputRef.current?.focus();
      } else {
        if (res.code === "ITEM_NOT_FOUND") {
          const scanned = (res.scanned ?? trimmed).trim();
          setStatus(`❌ Not in system: ${scanned}. Add it first (or map barcode to an existing item).`);
        } else {
          setStatus(`❌ Transaction failed: ${res.error ?? "Unknown error"}`);
        }
      }
    } catch (e: any) {
      setStatus(`❌ Transaction failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCameraScan() {
    setStatus("");
    try {
      setBusy(true);
      const code = await scanWithCameraOnce();
      setItemQuery(code);

      // Auto submit if enabled
      if (autoSubmit) {
        // tiny delay so state updates
        setTimeout(() => {
          submit();
        }, 50);
      } else {
        inputRef.current?.focus();
      }
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Scan failed"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/80 p-4 shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Location:</div>
              <div className="font-semibold">{currentLocationName}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            className={`flex-1 rounded-full px-4 py-2 font-semibold ${
              tab === "transaction" ? "bg-white text-black" : "bg-neutral-800 text-white"
            }`}
            onClick={() => setTab("transaction")}
          >
            Transaction
          </button>
          <button
            className={`flex-1 rounded-full px-4 py-2 font-semibold ${
              tab === "totals" ? "bg-white text-black" : "bg-neutral-800 text-white"
            }`}
            onClick={() => setTab("totals")}
          >
            Totals
          </button>
          <button
            className={`flex-1 rounded-full px-4 py-2 font-semibold ${
              tab === "settings" ? "bg-white text-black" : "bg-neutral-800 text-white"
            }`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </div>

        {/* Transaction tab */}
        {tab === "transaction" && (
          <div className="mt-4 space-y-4 rounded-2xl bg-neutral-900/80 p-4 shadow">
            {/* One-time override */}
            <div className="rounded-2xl bg-neutral-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">One-time override</div>
                  <div className="text-sm text-neutral-300">
                    Grabbed it from MAIN supply room? Tap this once.
                  </div>
                </div>

                <button
                  className={`rounded-2xl px-4 py-3 font-bold ${
                    overrideMainOnce ? "bg-yellow-500 text-black" : "bg-neutral-800 text-white"
                  }`}
                  onClick={() => setOverrideMainOnce((v) => !v)}
                  disabled={busy}
                >
                  ⚡ MAIN
                  <div className="text-xs font-semibold">(1x)</div>
                </button>
              </div>
            </div>

            {/* Mode */}
            <div className="rounded-2xl bg-neutral-950/60 p-4">
              <div className="text-lg font-bold">Mode</div>
              <div className="mt-3 flex gap-3">
                <button
                  className={`flex-1 rounded-2xl px-4 py-3 text-lg font-bold ${
                    mode === "USE" ? "bg-red-600 text-white" : "bg-neutral-800 text-white"
                  }`}
                  onClick={() => setMode("USE")}
                  disabled={busy}
                >
                  USE
                </button>
                <button
                  className={`flex-1 rounded-2xl px-4 py-3 text-lg font-bold ${
                    mode === "RESTOCK" ? "bg-green-600 text-white" : "bg-neutral-800 text-white"
                  }`}
                  onClick={() => setMode("RESTOCK")}
                  disabled={busy}
                >
                  RESTOCK
                </button>
              </div>

              {/* Item input + camera */}
              <div className="mt-4 flex gap-3">
                <input
                  ref={inputRef}
                  className="flex-1 rounded-2xl bg-white px-4 py-3 text-black outline-none"
                  placeholder="Scan barcode or type item name"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  disabled={busy}
                />

                <button
                  className="rounded-2xl bg-neutral-800 px-4 py-3 text-xl"
                  onClick={handleCameraScan}
                  disabled={busy}
                  title="Scan with camera"
                >
                  📷
                </button>
              </div>

              {/* Qty */}
              <div className="mt-3">
                <input
                  className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  disabled={busy}
                />
              </div>

              {/* Submit */}
              <button
                className="mt-4 w-full rounded-2xl bg-black px-4 py-4 text-xl font-bold text-white shadow"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Working..." : "Submit"}
              </button>

              {/* Status */}
              {status ? <div className="mt-4 text-sm text-neutral-200">{status}</div> : null}

              {/* Locations errors */}
              {locationsError ? (
                <div className="mt-3 text-sm text-yellow-400">
                  Locations error: {locationsError}
                </div>
              ) : null}
            </div>

            <div className="text-xs text-neutral-400">
              Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from supply.
            </div>
          </div>
        )}

        {/* Totals tab (simple placeholder - keep your real totals page later) */}
        {tab === "totals" && (
          <div className="mt-4 rounded-2xl bg-neutral-900/80 p-4 shadow">
            <div className="text-lg font-bold">Totals</div>
            <div className="mt-2 text-sm text-neutral-300">
              This tab is reserved for building totals / cabinet totals. (We can wire it to your views next.)
            </div>
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="mt-4 space-y-4 rounded-2xl bg-neutral-900/80 p-4 shadow">
            <div>
              <div className="text-lg font-bold">Location</div>

              {locations.length ? (
                <select
                  className="mt-2 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white outline-none"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={busy}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-2 text-sm text-neutral-300">
                  No locations loaded yet.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-neutral-950/60 p-4">
              <div className="text-lg font-bold">Scan behavior</div>

              <label className="mt-3 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={autoSubmit}
                  onChange={(e) => setAutoSubmit(e.target.checked)}
                />
                Auto-submit after scan
              </label>

              <div className="mt-2 text-xs text-neutral-400">
                Best experience is a Bluetooth/USB scanner (fast + reliable). Camera scan depends on device support.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
