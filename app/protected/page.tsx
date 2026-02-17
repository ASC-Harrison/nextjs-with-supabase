"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Tab = "transaction" | "totals" | "settings";
type TxMode = "USE" | "RESTOCK";
type LocationRow = { id: string; name: string };

type ItemRow = { id: string; name: string };

async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

export default function ProtectedPage() {
  const [tab, setTab] = useState<Tab>("transaction");

  // locations
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [locationsError, setLocationsError] = useState<string>("");

  const currentLocationName = useMemo(() => {
    return locations.find((l) => l.id === locationId)?.name || "—";
  }, [locations, locationId]);

  // transaction
  const [mode, setMode] = useState<TxMode>("USE");
  const [itemQuery, setItemQuery] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [overrideMainOnce, setOverrideMainOnce] = useState(false);
  const [status, setStatus] = useState("");

  // scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);

  // not found modal
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string>("");

  // attach UI
  const [attachSearch, setAttachSearch] = useState("");
  const [attachResults, setAttachResults] = useState<ItemRow[]>([]);
  const [attachSelectedId, setAttachSelectedId] = useState<string>("");
  const [attachNote, setAttachNote] = useState<string>("Substitute / alternate packaging");

  // create UI
  const [newName, setNewName] = useState("");
  const [newPar, setNewPar] = useState<number>(0);
  const [newLow, setNewLow] = useState<number>(0);
  const [newVendor, setNewVendor] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newRef, setNewRef] = useState("");

  // Load locations
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLocationsError("");
      const { res, data } = await fetchJson("/api/locations", { cache: "no-store" });
      if (cancelled) return;

      if (!res.ok || !data?.ok) {
        setLocations([]);
        setLocationId("");
        setLocationsError(data?.error || "Failed to load locations.");
        return;
      }

      const list: LocationRow[] = Array.isArray(data.locations) ? data.locations : [];
      setLocations(list);

      const saved = localStorage.getItem("asc_location_id");
      const pick = saved && list.some((x) => x.id === saved) ? saved : list[0]?.id || "";
      setLocationId(pick);
      if (pick) localStorage.setItem("asc_location_id", pick);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (locationId) localStorage.setItem("asc_location_id", locationId);
  }, [locationId]);

  // Search items for attach
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const q = attachSearch.trim();
      if (!q) {
        setAttachResults([]);
        setAttachSelectedId("");
        return;
      }
      const { res, data } = await fetchJson(`/api/items/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (!res.ok || !data?.ok) {
        setAttachResults([]);
        return;
      }
      setAttachResults(Array.isArray(data.items) ? data.items : []);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [attachSearch]);

  async function submitTransaction(overrideQuery?: string) {
    setStatus("");

    const cleaned = (overrideQuery ?? itemQuery).trim();
    if (!cleaned) {
      setStatus("❌ Enter an item name or barcode.");
      return;
    }
    if (!locationId) {
      setStatus("❌ No location selected.");
      return;
    }
    const safeQty = Math.max(1, Math.floor(Number(qty || 1)));

    const payload = {
      itemQuery: cleaned,
      qty: safeQty,
      action: mode,
      locationId,
      overrideMainOnce,
    };

    const { res, data } = await fetchJson("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (overrideMainOnce) setOverrideMainOnce(false);

    if (!res.ok) {
      if (data?.code === "ITEM_NOT_FOUND") {
        // Open modal to attach or create
        setPendingBarcode(data?.scanned || cleaned);
        setNotFoundOpen(true);

        // pre-fill create name from whatever user typed (helps when they typed a name)
        if (!newName) setNewName("");
        setStatus(`❌ Not in system: ${data?.scanned || cleaned}`);
        return;
      }

      setStatus(`❌ Transaction failed: ${data?.error || res.statusText}`);
      return;
    }

    setStatus("✅ Submitted");
    setItemQuery("");
    setQty(1);
  }

  async function handleAttach() {
    if (!pendingBarcode.trim()) return;
    if (!attachSelectedId) {
      setStatus("❌ Select an item to attach this barcode to.");
      return;
    }

    const { res, data } = await fetchJson("/api/items/attach-barcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: attachSelectedId,
        barcode: pendingBarcode.trim(),
        note: attachNote.trim(),
      }),
    });

    if (!res.ok || !data?.ok) {
      setStatus(`❌ Attach failed: ${data?.error || "Unknown error"}`);
      return;
    }

    setStatus("✅ Barcode attached. Scan again to submit.");
    setNotFoundOpen(false);

    // Auto-submit now that it’s attached
    await submitTransaction(pendingBarcode.trim());
  }

  async function handleCreateNew() {
    if (!pendingBarcode.trim()) return;

    const nm = newName.trim();
    if (!nm) {
      setStatus("❌ Enter a name for the new item.");
      return;
    }

    const { res, data } = await fetchJson("/api/items/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nm,
        par_level: Number(newPar || 0) || null,
        low_level: Number(newLow || 0) || null,
        vendor: newVendor.trim() || null,
        category: newCategory.trim() || null,
        reference_number: newRef.trim() || null,
        barcode: pendingBarcode.trim(), // attach the scanned barcode as alias
      }),
    });

    if (!res.ok || !data?.ok) {
      setStatus(`❌ Create failed: ${data?.error || "Unknown error"}`);
      return;
    }

    setStatus("✅ Item created. Submitted now…");
    setNotFoundOpen(false);

    // Auto-submit now that it exists
    await submitTransaction(pendingBarcode.trim());
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl bg-neutral-900/70 p-4 shadow ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-neutral-800 flex items-center justify-center ring-1 ring-white/10">
              <Image src="/asc-header-logo.png" alt="ASC" width={56} height={56} priority />
            </div>

            <div className="flex-1">
              <div className="text-xl font-bold leading-tight">Baxter ASC Inventory</div>
              <div className="text-sm text-neutral-300">Scan → auto submit → fix unknown barcodes instantly</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Location:</div>
              <div className="text-sm font-semibold">{currentLocationName}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <TabButton active={tab === "transaction"} onClick={() => setTab("transaction")}>Transaction</TabButton>
            <TabButton active={tab === "totals"} onClick={() => setTab("totals")}>Totals</TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>Settings</TabButton>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 rounded-2xl bg-neutral-900/70 p-4 shadow ring-1 ring-white/10">
          {tab === "transaction" && (
            <>
              {/* override */}
              <div className="rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">One-time override</div>
                    <div className="text-sm text-neutral-300">Grabbed it from MAIN supply room? Tap this once.</div>
                  </div>
                  <button
                    onClick={() => setOverrideMainOnce(true)}
                    className={`rounded-2xl px-4 py-3 font-semibold ${
                      overrideMainOnce ? "bg-yellow-500 text-black" : "bg-neutral-800 text-white"
                    }`}
                  >
                    ⚡ MAIN (1x)
                  </button>
                </div>
              </div>

              {/* mode */}
              <div className="mt-4 rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
                <div className="font-semibold mb-3">Mode</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("USE")}
                    className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                      mode === "USE" ? "bg-red-600" : "bg-neutral-800"
                    }`}
                  >
                    USE
                  </button>
                  <button
                    onClick={() => setMode("RESTOCK")}
                    className={`flex-1 rounded-2xl px-4 py-3 font-bold ${
                      mode === "RESTOCK" ? "bg-green-600" : "bg-neutral-800"
                    }`}
                  >
                    RESTOCK
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                      placeholder="Scan barcode or type item name"
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      onKeyDown={(e) => {
                        // handheld scanner usually sends Enter
                        if (e.key === "Enter") submitTransaction();
                      }}
                    />
                    <button
                      onClick={() => setScannerOpen(true)}
                      className="rounded-2xl bg-neutral-800 px-4 py-3 font-semibold ring-1 ring-white/10"
                      title="Scan"
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

                  <button
                    onClick={() => submitTransaction()}
                    className="w-full rounded-2xl bg-black py-4 text-lg font-bold ring-1 ring-white/10"
                  >
                    Submit
                  </button>

                  {status ? <div className="text-sm text-neutral-200">{status}</div> : null}

                  {locationsError ? (
                    <div className="text-sm text-yellow-300">Locations error: {locationsError}</div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {tab === "totals" && (
            <div className="rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
              <div className="text-lg font-bold">Totals</div>
              <div className="mt-2 text-sm text-neutral-300">
                (Optional next step) We can wire this to your building totals view.
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10 space-y-3">
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
                    <option value="">No locations</option>
                  ) : (
                    locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Scanner */}
      {scannerOpen && (
        <ScannerModal
          onClose={() => setScannerOpen(false)}
          onDetected={async (val) => {
            const scanned = (val || "").trim();
            if (!scanned) return;

            setItemQuery(scanned);
            setScannerOpen(false);

            // ✅ AUTO SUBMIT immediately
            await submitTransaction(scanned);
          }}
        />
      )}

      {/* Not Found Modal */}
      {notFoundOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-neutral-900 p-4 shadow ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">Not in system</div>
              <button
                onClick={() => setNotFoundOpen(false)}
                className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="mt-2 text-sm text-neutral-300">
              Scanned barcode:
              <div className="mt-1 rounded-xl bg-neutral-800 px-3 py-2 font-mono text-white">
                {pendingBarcode}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Attach to existing */}
              <div className="rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
                <div className="font-bold">Attach to existing item</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Use this for substitutes / alternate packaging of the same item.
                </div>

                <input
                  className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                  placeholder="Search item name (ex: Gloves medium)"
                  value={attachSearch}
                  onChange={(e) => setAttachSearch(e.target.value)}
                />

                <select
                  className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white"
                  value={attachSelectedId}
                  onChange={(e) => setAttachSelectedId(e.target.value)}
                >
                  <option value="">Select item…</option>
                  {attachResults.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>

                <input
                  className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white outline-none"
                  placeholder="Note (optional)"
                  value={attachNote}
                  onChange={(e) => setAttachNote(e.target.value)}
                />

                <button
                  onClick={handleAttach}
                  className="mt-3 w-full rounded-2xl bg-blue-600 py-3 font-bold"
                >
                  Attach Barcode
                </button>
              </div>

              {/* Create new item */}
              <div className="rounded-2xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
                <div className="font-bold">Create new item</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Use this if it’s truly a different item you want tracked separately.
                </div>

                <input
                  className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                  placeholder="Item name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                    type="number"
                    placeholder="Par"
                    value={newPar}
                    onChange={(e) => setNewPar(Number(e.target.value))}
                  />
                  <input
                    className="w-full rounded-2xl bg-white px-4 py-3 text-black outline-none"
                    type="number"
                    placeholder="Low"
                    value={newLow}
                    onChange={(e) => setNewLow(Number(e.target.value))}
                  />
                </div>

                <input
                  className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white outline-none"
                  placeholder="Vendor (optional)"
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                />
                <input
                  className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white outline-none"
                  placeholder="Category (optional)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <input
                  className="mt-3 w-full rounded-2xl bg-neutral-800 px-4 py-3 text-white outline-none"
                  placeholder="Reference # (optional)"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                />

                <button
                  onClick={handleCreateNew}
                  className="mt-3 w-full rounded-2xl bg-green-600 py-3 font-bold"
                >
                  Create Item
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-neutral-400">
              After attaching/creating, the app auto-submits the transaction for this scan.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function ScannerModal({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (value: string) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setErr("");

      // @ts-ignore
      const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
      if (!supported) {
        setErr("Scanner not supported on this browser. Use manual entry or a scanner that types into the field.");
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
                await onDetected(raw);
                return;
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setErr(e?.message || "Camera permission denied.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900 p-4 shadow ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">Scan Barcode</div>
          <button onClick={onClose} className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold">
            Close
          </button>
        </div>

        <div className="mt-3 rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-72 object-cover" playsInline muted />
        </div>

        {err ? (
          <div className="mt-3 text-sm text-yellow-300">{err}</div>
        ) : (
          <div className="mt-3 text-sm text-neutral-300">Point the camera at the barcode…</div>
        )}
      </div>
    </div>
  );
}
