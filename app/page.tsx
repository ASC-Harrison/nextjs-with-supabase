"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserMultiFormatReader } from "@zxing/browser";

type Tab = "Transaction" | "Totals" | "Settings";
type Mode = "USE" | "RESTOCK";
type Area = { id: string; name: string };
type Item = { id: string; name: string; barcode: string };

const LS = {
  PIN: "asc_pin_v1",
  LOCKED: "asc_locked_v1",
  AREA: "asc_area_id_v1",
  STAFF: "asc_staff_v1",
  DEVICE: "asc_device_v1",
};

export default function Page() {
  const [tab, setTab] = useState<Tab>("Transaction");
  const [mode, setMode] = useState<Mode>("USE");
  const [qty, setQty] = useState(1);
  const [mainOverride, setMainOverride] = useState(false);

  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState("");
  const [areasLoading, setAreasLoading] = useState(true);

  const selectedAreaName = useMemo(
    () => areas.find((a) => a.id === areaId)?.name ?? "—",
    [areas, areaId]
  );

  const [locked, setLocked] = useState(true);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<"unlock" | "lock" | "changeLocation" | "addItem">("unlock");
  const [pinInput, setPinInput] = useState("");
  const [pendingArea, setPendingArea] = useState("");

  const [staff, setStaff] = useState("");
  const [device, setDevice] = useState("");

  const [query, setQuery] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPar, setAddPar] = useState<number>(0);

  // Camera UI
  const [scanOpen, setScanOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<string>("");

  // Load saved state
  useEffect(() => {
    try {
      setLocked((localStorage.getItem(LS.LOCKED) ?? "1") === "1");
      const savedArea = localStorage.getItem(LS.AREA);
      if (savedArea) setAreaId(savedArea);

      const s = localStorage.getItem(LS.STAFF) ?? "";
      const d = localStorage.getItem(LS.DEVICE) ?? "";
      setStaff(s);
      setDevice(d);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS.LOCKED, locked ? "1" : "0");
    } catch {}
  }, [locked]);

  useEffect(() => {
    try {
      if (areaId) localStorage.setItem(LS.AREA, areaId);
    } catch {}
  }, [areaId]);

  // Load locations from storage_areas
  useEffect(() => {
    (async () => {
      setAreasLoading(true);
      try {
        const res = await fetch("/api/locations", { method: "GET", cache: "no-store" });
        const json = await res.json();

        if (!json.ok) {
          setStatus(`Locations error: ${json.error}`);
          setAreas([]);
          setAreaId("");
          return;
        }

        const list: Area[] = json.locations ?? [];
        setAreas(list);

        setAreaId((prev) => {
          if (!list.length) return "";
          return list.some((a) => a.id === prev) ? prev : list[0].id;
        });

        setStatus("");
      } catch (e: any) {
        setStatus(`Locations fetch failed: ${e?.message ?? "unknown"}`);
        setAreas([]);
        setAreaId("");
      } finally {
        setAreasLoading(false);
      }
    })();
  }, []);

  // Stop scanner if leaving Transaction or closing scan modal
  useEffect(() => {
    if (tab !== "Transaction") closeScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!scanOpen) closeScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  function openPin(purpose: typeof pinPurpose) {
    setPinPurpose(purpose);
    setPinInput("");
    setPinOpen(true);
  }

  function checkPin(): boolean {
    const real = (() => {
      try {
        return localStorage.getItem(LS.PIN) || "1234";
      } catch {
        return "1234";
      }
    })();
    return pinInput.trim() === real;
  }

  async function onPinConfirm() {
    if (!checkPin()) return alert("Wrong PIN");
    setPinOpen(false);

    if (pinPurpose === "unlock") { setLocked(false); return; }
    if (pinPurpose === "lock") { setLocked(true); return; }

    if (pinPurpose === "changeLocation") {
      if (pendingArea) setAreaId(pendingArea);
      setPendingArea("");
      return;
    }

    if (pinPurpose === "addItem") {
      await addItemNow(true);
      return;
    }
  }

  function requestLocationChange(newId: string) {
    if (!locked) { setAreaId(newId); return; }
    setPendingArea(newId);
    openPin("changeLocation");
  }

  async function lookupBarcode(barcode: string) {
    setItem(null);
    setStatus("Looking up…");

    const res = await fetch("/api/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ barcode }),
    });

    const json = await res.json();
    if (!json.ok) {
      setStatus(`Lookup failed: ${json.error}`);
      return;
    }

    if (!json.item) {
      setStatus("NOT FOUND — Add Item");
      setAddOpen(true);
      setAddName("");
      return;
    }

    setItem(json.item);
    setStatus(`Found: ${json.item.name}`);
  }

  async function startScanner() {
    setScanOpen(true);

    // Wait for modal/video to exist
    setTimeout(async () => {
      if (!videoRef.current) return;

      closeScanner();

      try {
        const mod = await import("@zxing/browser");
        const Reader = mod.BrowserMultiFormatReader;
        const reader = new Reader();
        readerRef.current = reader;

        setStatus("Scanning…");

        await reader.decodeFromVideoDevice(
          { facingMode: "environment" },
          videoRef.current,
          async (result, err) => {
            if (!result) return;
            const text = result.getText?.() ?? "";
            if (!text) return;

            if (text === lastScanRef.current) return;
            lastScanRef.current = text;

            setQuery(text);
            setScanOpen(false); // close preview on successful scan
            await lookupBarcode(text);
          }
        );
      } catch (e: any) {
        setStatus("Camera blocked. Allow camera permissions in Safari.");
        alert("Camera blocked. Allow camera permissions in Safari.");
      }
    }, 150);
  }

  function closeScanner() {
    try {
      (readerRef.current as any)?.reset?.();
    } catch {}
    readerRef.current = null;
    lastScanRef.current = "";
  }

  async function addItemNow(pinAlreadyPassed = false) {
    if (locked && !pinAlreadyPassed) {
      openPin("addItem");
      return;
    }

    const barcode = query.trim();
    if (!barcode) return alert("No barcode scanned.");
    if (!addName.trim()) return alert("Enter item name.");
    if (!areaId) return alert("Select a location.");

    const res = await fetch("/api/items/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        name: addName.trim(),
        barcode,
        area_id: areaId,
        par_level: addPar,
        actor: staff || null,
        device: device || null,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Add failed: ${json.error}`);

    setItem(json.item);
    setAddOpen(false);
    setStatus(`Added: ${json.item.name}`);
  }

  async function submit() {
    if (locked) return alert("Locked. Unlock first.");
    if (!item?.id) return alert("Scan an item first.");
    if (!areaId && !mainOverride) return alert("Select a location.");

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        area_id: areaId,
        mode,
        item_id: item.id,
        qty,
        mainOverride,
        actor: staff || null,
        device: device || null,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Transaction failed: ${json.error}`);

    setMainOverride(false);
    setQty(1);
    setStatus(`✅ Updated on-hand to ${json.on_hand}`);
  }

  function savePin(newPin: string) {
    const cleaned = newPin.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length < 4) return alert("PIN must be at least 4 digits.");
    try { localStorage.setItem(LS.PIN, cleaned); } catch {}
    alert("PIN saved ✅");
  }

  function saveStaffDevice() {
    try {
      localStorage.setItem(LS.STAFF, staff.trim());
      localStorage.setItem(LS.DEVICE, device.trim());
    } catch {}
    alert("Saved ✅");
  }

  return (
    <div className="min-h-screen w-full flex justify-center">
      <div className="w-full max-w-md px-3 pb-4 overflow-x-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="rounded-3xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
            <div className="min-w-0">
              <div className="text-3xl font-extrabold leading-none">Baxter ASC Inventory</div>
              <div className="mt-1 text-xs text-white/60">
                Staff: {staff || "—"} • Device: {device || "—"}
              </div>
            </div>

            <div className="text-right min-w-[140px]">
              <div className="text-[11px] text-white/60">Location</div>
              <div className="text-sm font-semibold leading-tight break-words">{selectedAreaName}</div>

              <button
                onClick={() => openPin(locked ? "unlock" : "lock")}
                className="mt-2 w-full rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10 text-sm font-semibold"
              >
                {locked ? "🔒 Locked" : "🔓 Unlocked"}
              </button>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <TabBtn active={tab === "Transaction"} onClick={() => setTab("Transaction")}>Transaction</TabBtn>
            <TabBtn active={tab === "Totals"} onClick={() => setTab("Totals")}>Totals</TabBtn>
            <TabBtn active={tab === "Settings"} onClick={() => setTab("Settings")}>Settings</TabBtn>
          </div>
        </div>

        {tab === "Transaction" ? (
          <div className="mt-2 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-sm text-white/70">Select location</div>

            <select
              value={areaId}
              onChange={(e) => requestLocationChange(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10"
            >
              {areasLoading ? (
                <option value="">Loading locations…</option>
              ) : areas.length === 0 ? (
                <option value="">No locations found</option>
              ) : (
                areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))
              )}
            </select>

            {locked && <div className="mt-2 text-xs text-white/50">Locked: PIN required to change location & add items.</div>}

            <div className="mt-2 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">One-time override</div>
                  <div className="mt-1 text-sm text-white/70">Grabbed it from MAIN supply room? Tap once.</div>
                </div>
                <button
                  onClick={() => setMainOverride((v) => !v)}
                  className={[
                    "shrink-0 rounded-2xl px-4 py-3 ring-1",
                    mainOverride ? "bg-white text-black ring-white/20" : "bg-black/40 text-white ring-white/10",
                  ].join(" ")}
                >
                  <div className="text-xs opacity-80">⚡</div>
                  <div className="text-sm font-semibold">MAIN <span className="opacity-70">(1x)</span></div>
                </button>
              </div>
            </div>

            <div className="mt-2 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">Mode</div>
                  <div className="mt-1 text-sm text-white/70">
                    {mode === "USE" ? "Use removes items from on-hand." : "Restock adds items to on-hand."}
                  </div>
                </div>
                <div className="flex gap-2">
                  <ModeBtn active={mode === "USE"} danger onClick={() => setMode("USE")}>USE</ModeBtn>
                  <ModeBtn active={mode === "RESTOCK"} onClick={() => setMode("RESTOCK")}>RESTOCK</ModeBtn>
                </div>
              </div>
            </div>

            <div className="mt-2">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const v = query.trim();
                      if (v) await lookupBarcode(v);
                    }
                  }}
                  placeholder="Scan barcode or type item"
                  className="w-full rounded-2xl bg-white text-black px-4 py-3 pr-14"
                />
                <button
                  onClick={() => startScanner()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-black/10 px-3 py-2 text-black"
                  aria-label="Start scanner"
                >
                  📷
                </button>
              </div>
            </div>

            <div className="mt-2 text-sm text-white/70">{status || "Ready."}</div>

            {item && (
              <div className="mt-2 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-xs text-white/60 break-all">{item.barcode}</div>
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <QtyBtn onClick={() => setQty((q) => Math.max(1, q - 1))}>−</QtyBtn>
              <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-black">
                <span className="text-lg font-semibold">{qty}</span>
              </div>
              <QtyBtn onClick={() => setQty((q) => q + 1)}>+</QtyBtn>
            </div>

            <button
              className="mt-2 w-full rounded-2xl bg-black/80 px-4 py-4 text-white font-semibold disabled:opacity-60"
              disabled={!item || locked}
              onClick={submit}
            >
              Submit
            </button>

            {addOpen && (
              <Modal title="Item not found" okText="Add Item" onCancel={() => setAddOpen(false)} onOk={() => addItemNow()}>
                <div className="mt-1 text-sm text-white/70 break-all">Barcode: {query}</div>

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
                    inputMode="numeric"
                    className="w-full rounded-2xl bg-white text-black px-4 py-3"
                    placeholder="0"
                  />
                </div>
              </Modal>
            )}

            {pinOpen && (
              <Modal
                title={
                  pinPurpose === "unlock"
                    ? "Enter PIN to unlock"
                    : pinPurpose === "lock"
                    ? "Enter PIN to lock"
                    : pinPurpose === "changeLocation"
                    ? "Enter PIN to change location"
                    : "Enter PIN to add item"
                }
                okText="OK"
                onCancel={() => { setPinOpen(false); setPendingArea(""); }}
                onOk={onPinConfirm}
              >
                <input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  className="mt-3 w-full rounded-2xl bg-white text-black px-4 py-3"
                  placeholder="PIN"
                />
                <div className="mt-2 text-xs text-white/50">
                  Default PIN is <span className="font-semibold">1234</span> until set in Settings.
                </div>
              </Modal>
            )}

            {/* Camera preview modal (THIS FIXES iPhone scanning reliability) */}
            {scanOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-end justify-center">
                <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">Scan barcode</div>
                    <button
                      onClick={() => setScanOpen(false)}
                      className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/10"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-black">
                    <video
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      muted
                      playsInline
                      autoPlay
                    />
                  </div>

                  <div className="mt-3 text-sm text-white/70">
                    Point the camera at the barcode. It will auto-scan.
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : tab === "Totals" ? (
          <div className="mt-2 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-semibold">Totals</div>
            <div className="mt-2 text-sm text-white/70">
              (Totals UI stays as you already have it — we didn’t touch it here.)
            </div>
            <div className="mt-2 text-sm text-white/60">
              Audit log is now stored in Supabase table <span className="font-semibold">inventory_events</span>.
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-semibold">Settings</div>

            <div className="mt-4">
              <div className="text-sm text-white/70">Staff name (audit log)</div>
              <input
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g. Jeremy"
              />
            </div>

            <div className="mt-4">
              <div className="text-sm text-white/70">Device name (audit log)</div>
              <input
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g. OR1 iPhone"
              />
            </div>

            <button
              onClick={saveStaffDevice}
              className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black"
            >
              Save Staff/Device
            </button>

            <div className="mt-6 text-sm text-white/70">Set/Change PIN (min 4 digits):</div>
            <PinSetter onSave={savePin} />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 rounded-2xl px-3 py-2 text-sm font-semibold ring-1",
        active ? "bg-white text-black ring-white/20" : "bg-white/5 text-white ring-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ModeBtn({ active, danger, onClick, children }: any) {
  const activeCls = danger ? "bg-red-600 text-white ring-red-500/30" : "bg-white text-black ring-white/20";
  const inactiveCls = "bg-black/30 text-white ring-white/10";
  return (
    <button onClick={onClick} className={["rounded-2xl px-3 py-2 text-sm font-bold ring-1", active ? activeCls : inactiveCls].join(" ")}>
      {children}
    </button>
  );
}

function QtyBtn({ onClick, children }: any) {
  return (
    <button onClick={onClick} className="h-12 w-12 rounded-2xl bg-white/5 text-white text-xl font-semibold ring-1 ring-white/10">
      {children}
    </button>
  );
}

function Modal({ title, children, okText, onOk, onCancel }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
        <div className="text-lg font-semibold">{title}</div>
        {children}
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold">Cancel</button>
          <button onClick={onOk} className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-black">{okText}</button>
        </div>
      </div>
    </div>
  );
}

function PinSetter({ onSave }: any) {
  const [pin, setPin] = useState("");
  return (
    <div className="mt-2">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full rounded-2xl bg-white text-black px-4 py-3"
        placeholder="New PIN (e.g. 1234)"
        inputMode="numeric"
      />
      <button onClick={() => onSave(pin)} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black">
        Save PIN
      </button>
    </div>
  );
}
