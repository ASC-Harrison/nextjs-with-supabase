"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserMultiFormatReader } from "@zxing/browser";

type Tab = "Transaction" | "Totals" | "Settings";
type Mode = "USE" | "RESTOCK";

type AreaRow = { id: string; name: string };
type ItemRow = { id: string; name: string; barcode: string };

export default function Page() {
  const [tab, setTab] = useState<Tab>("Transaction");
  const [mode, setMode] = useState<Mode>("USE");
  const [qty, setQty] = useState(1);
  const [mainOverride, setMainOverride] = useState(false);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areaId, setAreaId] = useState<string>("");

  const [barcodeOrText, setBarcodeOrText] = useState("");
  const [resolvedItem, setResolvedItem] = useState<ItemRow | null>(null);
  const [status, setStatus] = useState("");

  // add-item modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPar, setAddPar] = useState<number>(0);

  // scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<string>("");

  const modeHelp = useMemo(
    () => (mode === "USE" ? "Use removes items from on-hand." : "Restock adds items to on-hand."),
    [mode]
  );

  // load areas
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/locations");
      const json = await res.json();
      if (!json.ok) {
        setStatus(`Area load failed: ${json.error}`);
        return;
      }
      setAreas(json.locations);
      setAreaId(json.locations?.[0]?.id ?? "");
    })();
  }, []);

  // auto-start scanner on Transaction tab (iPhone may require user gesture; button also starts it)
  useEffect(() => {
    if (tab !== "Transaction") {
      stopScanner();
      return;
    }
    startScanner().catch(() => {
      setStatus("Tap the camera button to start scanning (iPhone permission).");
    });
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function startScanner() {
    if (!videoRef.current) return;

    stopScanner();

    const mod = await import("@zxing/browser");
    const Reader = mod.BrowserMultiFormatReader;
    const reader = new Reader();
    readerRef.current = reader;

    setStatus("Scanning…");

    await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
      if (!result) return;
      const text = result.getText?.() ?? "";
      if (!text) return;

      if (text === lastScanRef.current) return;
      lastScanRef.current = text;

      setBarcodeOrText(text);
      await lookupBarcode(text);
    });
  }

  function stopScanner() {
    try {
      // typings differ by version; this avoids TS build failures
      (readerRef.current as any)?.reset?.();
    } catch {}
    readerRef.current = null;
  }

  async function lookupBarcode(code: string) {
    setResolvedItem(null);
    setStatus("Looking up item…");

    const res = await fetch("/api/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: code }),
    });

    const json = await res.json();
    if (!json.ok) {
      setStatus(`Lookup failed: ${json.error}`);
      return;
    }

    if (!json.item) {
      setStatus("NOT FOUND — add it now.");
      setAddOpen(true);
      setAddName("");
      return;
    }

    setResolvedItem(json.item);
    setStatus(`Found: ${json.item.name}`);
  }

  async function addItemNow() {
    const barcode = barcodeOrText.trim();
    if (!barcode) return alert("No barcode scanned.");
    if (!addName.trim()) return alert("Enter item name.");
    if (!areaId) return alert("Select a location.");

    const res = await fetch("/api/items/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addName.trim(),
        barcode,
        area_id: areaId,
        par_level: addPar,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Add failed: ${json.error}`);

    setResolvedItem(json.item);
    setAddOpen(false);
    setStatus(`Added: ${json.item.name}`);
  }

  async function submitTransaction() {
    if (!resolvedItem?.id) return alert("Scan an item first.");
    if (!areaId && !mainOverride) return alert("Select a location.");

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area_id: areaId,
        mode,
        item_id: resolvedItem.id,
        qty,
        mainOverride,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Transaction failed: ${json.error}`);

    setMainOverride(false);
    setQty(1);
    setStatus(`✅ Updated on-hand to ${json.on_hand}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 safe-bottom">
      {/* Header */}
      <div className="pt-4 safe-top">
        <div className="text-sm text-white/70">ASC</div>
        <div className="text-4xl font-bold leading-tight">Inventory</div>
        <div className="mt-2 text-sm text-white/70">
          Cabinet tracking + building totals + low stock alerts
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-3">
        <TabButton active={tab === "Transaction"} onClick={() => setTab("Transaction")}>
          Transaction
        </TabButton>
        <TabButton active={tab === "Totals"} onClick={() => setTab("Totals")}>
          Totals
        </TabButton>
        <TabButton active={tab === "Settings"} onClick={() => setTab("Settings")}>
          Settings
        </TabButton>
      </div>

      {/* Transaction */}
      {tab === "Transaction" ? (
        <div className="mt-5 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          {/* Select location */}
          <div className="text-sm text-white/70">Select location</div>
          <div className="mt-2">
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full rounded-2xl bg-black/40 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {areas.length === 0 ? (
                <option>No locations found</option>
              ) : (
                areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* One-time override */}
          <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">One-time override</div>
                <div className="mt-1 text-sm text-white/70">
                  Grabbed it from <span className="font-semibold text-white/85">MAIN</span> supply room? Tap this once.
                </div>
              </div>

              <button
                onClick={() => setMainOverride((v) => !v)}
                className={[
                  "shrink-0 rounded-2xl px-4 py-3 ring-1 transition",
                  mainOverride
                    ? "bg-white text-black ring-white/20"
                    : "bg-black/40 text-white ring-white/10 hover:ring-white/20",
                ].join(" ")}
              >
                <div className="text-xs opacity-80">⚡</div>
                <div className="text-sm font-semibold">
                  MAIN <span className="opacity-70">(1x)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Mode */}
          <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Mode</div>
                <div className="mt-1 text-sm text-white/70">{modeHelp}</div>
              </div>
              <div className="flex gap-2">
                <ModeButton active={mode === "USE"} tone="danger" onClick={() => setMode("USE")}>
                  USE
                </ModeButton>
                <ModeButton active={mode === "RESTOCK"} tone="neutral" onClick={() => setMode("RESTOCK")}>
                  RESTOCK
                </ModeButton>
              </div>
            </div>
          </div>

          {/* Scan input (camera button INSIDE input — matches desktop look) */}
          <div className="mt-4">
            <div className="relative w-full">
              <input
                value={barcodeOrText}
                onChange={(e) => setBarcodeOrText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const v = barcodeOrText.trim();
                    if (v) await lookupBarcode(v);
                  }
                }}
                placeholder="Scan barcode or type item"
                className="w-full rounded-2xl bg-white text-black placeholder-black/50 px-4 py-3 pr-14 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
              />
              <button
                type="button"
                onClick={() => startScanner().catch(() => setStatus("Camera permission blocked. Try again."))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-black/10 px-3 py-2 text-black hover:bg-black/20"
                aria-label="Start scanner"
              >
                📷
              </button>
            </div>
          </div>

          {/* Hidden video for scanning so UI stays identical */}
          <video
            ref={videoRef}
            className="absolute w-px h-px opacity-0 pointer-events-none"
            muted
            playsInline
          />

          {/* Status */}
          <div className="mt-3 text-sm text-white/70">{status || "Ready."}</div>
          {resolvedItem ? (
            <div className="mt-2 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
              <div className="text-sm font-semibold">{resolvedItem.name}</div>
              <div className="text-xs text-white/60 break-all">{resolvedItem.barcode}</div>
            </div>
          ) : null}

          {/* Qty */}
          <div className="mt-4 flex items-center gap-3">
            <QtyButton onClick={() => setQty((q) => Math.max(1, q - 1))}>−</QtyButton>
            <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-black ring-1 ring-black/10">
              <span className="text-lg font-semibold">{qty}</span>
            </div>
            <QtyButton onClick={() => setQty((q) => q + 1)}>+</QtyButton>
          </div>

          {/* Submit */}
          <button
            className="mt-4 w-full rounded-2xl bg-black/80 px-4 py-4 text-white font-semibold hover:bg-black disabled:opacity-60"
            onClick={submitTransaction}
            disabled={!resolvedItem}
          >
            Submit
          </button>

          {/* Add item modal */}
          {addOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
                <div className="text-lg font-semibold">Item not found</div>
                <div className="mt-1 text-sm text-white/70 break-all">Barcode: {barcodeOrText}</div>

                <div className="mt-3">
                  <div className="text-xs text-white/60 mb-1">Item name</div>
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full rounded-2xl bg-white text-black px-4 py-3"
                    placeholder="Type item name…"
                  />
                </div>

                <div className="mt-3">
                  <div className="text-xs text-white/60 mb-1">Par level (optional)</div>
                  <input
                    value={String(addPar)}
                    onChange={(e) => setAddPar(Number(e.target.value || 0))}
                    className="w-full rounded-2xl bg-white text-black px-4 py-3"
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setAddOpen(false)}
                    className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addItemNow}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-black"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : tab === "Totals" ? (
        <div className="mt-5 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Totals</div>
          <div className="mt-2 text-sm text-white/70">(Hook this to storage_inventory totals next.)</div>
        </div>
      ) : (
        <div className="mt-5 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Settings</div>
          <div className="mt-2 text-sm text-white/70">(Lock/unlock, staff PIN, etc. next.)</div>
        </div>
      )}
    </div>
  );
}

/* UI helpers */
function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition",
        active ? "bg-white text-black ring-white/20" : "bg-white/5 text-white ring-white/10 hover:ring-white/20",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  tone,
  children,
  onClick,
}: {
  active: boolean;
  tone: "danger" | "neutral";
  children: React.ReactNode;
  onClick: () => void;
}) {
  const activeCls =
    tone === "danger" ? "bg-red-600 text-white ring-red-500/30" : "bg-white text-black ring-white/20";
  const inactiveCls = "bg-black/30 text-white ring-white/10 hover:ring-white/20";

  return (
    <button
      onClick={onClick}
      className={["rounded-2xl px-4 py-3 text-sm font-bold ring-1 transition", active ? activeCls : inactiveCls].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function QtyButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-12 w-12 rounded-2xl bg-white/5 text-white text-xl font-semibold ring-1 ring-white/10 hover:ring-white/20"
    >
      {children}
    </button>
  );
}
