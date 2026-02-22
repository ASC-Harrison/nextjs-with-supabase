"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrowserMultiFormatReader } from "@zxing/browser";

type Tab = "Transaction" | "Totals" | "Audit" | "Settings";
type Mode = "USE" | "RESTOCK";
type Area = { id: string; name: string };
type Item = { id: string; name: string; barcode: string };

type AuditEvent = {
  id: string;
  ts: string; // ISO
  staff: string;
  action:
    | "SCAN"
    | "LOOKUP_FOUND"
    | "LOOKUP_NOT_FOUND"
    | "ADD_ITEM"
    | "SUBMIT_TX"
    | "CHANGE_LOCATION"
    | "LOCK"
    | "UNLOCK"
    | "MAIN_OVERRIDE_ON"
    | "MAIN_OVERRIDE_OFF"
    | "SCANNER_OPEN"
    | "SCANNER_CLOSE";
  details?: string;
};

const LS = {
  PIN: "asc_pin_v1",
  LOCKED: "asc_locked_v1",
  AREA: "asc_area_id_v1",
  STAFF: "asc_staff_name_v1",
  AUDIT: "asc_audit_events_v1",
};

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function InventoryPage() {
  const router = useRouter();

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
  const [pinPurpose, setPinPurpose] = useState<
    "unlock" | "lock" | "changeLocation" | "addItem"
  >("unlock");
  const [pinInput, setPinInput] = useState("");
  const [pendingArea, setPendingArea] = useState("");

  const [query, setQuery] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPar, setAddPar] = useState<number>(0);

  // ✅ Audit + staff
  const [staffName, setStaffName] = useState("");
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  // ✅ Full-screen scanner overlay
  const [scannerOpen, setScannerOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<string>("");
  const scanCooldownRef = useRef<number>(0);

  // ---------- LOAD SAVED STATE ----------
  useEffect(() => {
    try {
      setLocked((localStorage.getItem(LS.LOCKED) ?? "1") === "1");

      const savedArea = localStorage.getItem(LS.AREA);
      if (savedArea) setAreaId(savedArea);

      const savedStaff = localStorage.getItem(LS.STAFF) || "";
      setStaffName(savedStaff);

      const savedAudit = safeJsonParse<AuditEvent[]>(
        localStorage.getItem(LS.AUDIT),
        []
      );
      setAudit(savedAudit);
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

  useEffect(() => {
    try {
      localStorage.setItem(LS.STAFF, staffName);
    } catch {}
  }, [staffName]);

  useEffect(() => {
    try {
      localStorage.setItem(LS.AUDIT, JSON.stringify(audit.slice(0, 500)));
    } catch {}
  }, [audit]);

  function pushAudit(ev: Omit<AuditEvent, "id" | "ts" | "staff">) {
    const staff = (staffName || "").trim() || "Unknown";
    const entry: AuditEvent = {
      id: uid(),
      ts: nowIso(),
      staff,
      action: ev.action,
      details: ev.details,
    };
    setAudit((prev) => [entry, ...prev].slice(0, 500));
  }

  // ---------- LOAD LOCATIONS ----------
  useEffect(() => {
    (async () => {
      setAreasLoading(true);
      try {
        const res = await fetch("/api/locations", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

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

  // ---------- SCANNER LIFECYCLE ----------
  useEffect(() => {
    if (!scannerOpen) stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    if (tab !== "Transaction") {
      stopScanner();
      setScannerOpen(false);
    }
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function startScanner() {
    if (!staffName.trim()) {
      setTab("Audit");
      setStatus("Set staff name first (Audit tab).");
      return;
    }

    setScannerOpen(true);
    pushAudit({ action: "SCANNER_OPEN", details: `Area=${selectedAreaName}` });
    setStatus("Starting camera…");

    await new Promise((r) => setTimeout(r, 80));

    if (!videoRef.current) {
      setStatus("Camera view not ready.");
      return;
    }

    stopScanner();

    try {
      const mod = await import("@zxing/browser");
      const Reader = mod.BrowserMultiFormatReader;
      const reader = new Reader();
      readerRef.current = reader;

      setStatus("Scanning…");
      pushAudit({ action: "SCAN", details: `Area=${selectedAreaName}` });

      // ✅ Prefer back camera + higher resolution
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      // Get our own stream so iOS actually uses the back camera and decent quality
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const v: any = videoRef.current;
      v.srcObject = stream;
      await v.play();

      // Decode from the video element
      const decodeFromVideoElement =
        (reader as any).decodeFromVideoElement?.bind(reader);

      if (decodeFromVideoElement) {
        await decodeFromVideoElement(videoRef.current, async (result: any) => {
          if (!result) return;
          const text = result.getText?.() ?? "";
          if (!text) return;

          const now = Date.now();
          if (now < scanCooldownRef.current) return;
          scanCooldownRef.current = now + 900;

          // prevent exact same spam
          if (text === lastScanRef.current && now < scanCooldownRef.current + 1) return;
          lastScanRef.current = text;

          setQuery(text);

          stopScanner();
          setScannerOpen(false);

          await lookupBarcode(text);
        });
      } else {
        // Fallback (older zxing versions)
        await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result) => {
            if (!result) return;
            const text = result.getText?.() ?? "";
            if (!text) return;

            const now = Date.now();
            if (now < scanCooldownRef.current) return;
            scanCooldownRef.current = now + 900;

            if (text === lastScanRef.current) return;
            lastScanRef.current = text;

            setQuery(text);

            stopScanner();
            setScannerOpen(false);

            await lookupBarcode(text);
          }
        );
      }
    } catch {
      setScannerOpen(false);
      setStatus("Camera blocked.");
      alert(
        "Camera blocked.\n\nOn iPhone:\nSettings → Safari → Camera → Allow\nThen refresh and try again."
      );
    }
  }

  function stopScanner() {
    try {
      (readerRef.current as any)?.reset?.();
    } catch {}
    readerRef.current = null;
    lastScanRef.current = "";
    scanCooldownRef.current = 0;

    try {
      const v = videoRef.current as any;
      const stream = v?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    } catch {}
  }

  function closeScanner() {
    stopScanner();
    setScannerOpen(false);
    pushAudit({ action: "SCANNER_CLOSE" });
    setStatus("Stopped.");
  }

  // ---------- LOOKUP / ADD / SUBMIT ----------
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
      pushAudit({ action: "LOOKUP_NOT_FOUND", details: `Barcode=${barcode}` });
      setAddOpen(true);
      setAddName("");
      return;
    }

    setItem(json.item);
    setStatus(`Found: ${json.item.name}`);
    pushAudit({
      action: "LOOKUP_FOUND",
      details: `Item=${json.item.name} Barcode=${barcode}`,
    });
  }

  function openPin(purpose: typeof pinPurpose) {
    setPinPurpose(purpose);
    setPinInput("");
    setPinOpen(true);
  }

  function checkPin(): boolean {
    const real = localStorage.getItem(LS.PIN) || "1234";
    return pinInput.trim() === real;
  }

  async function onPinConfirm() {
    if (!checkPin()) return alert("Wrong PIN");
    setPinOpen(false);

    if (pinPurpose === "unlock") {
      setLocked(false);
      pushAudit({ action: "UNLOCK", details: `Area=${selectedAreaName}` });
      return;
    }

    if (pinPurpose === "lock") {
      setLocked(true);
      pushAudit({ action: "LOCK", details: `Area=${selectedAreaName}` });
      return;
    }

    if (pinPurpose === "changeLocation") {
      if (pendingArea) {
        const nextName =
          areas.find((a) => a.id === pendingArea)?.name ?? pendingArea;
        setAreaId(pendingArea);
        pushAudit({ action: "CHANGE_LOCATION", details: `To=${nextName}` });
      }
      setPendingArea("");
      return;
    }

    if (pinPurpose === "addItem") {
      await addItemNow(true);
      return;
    }
  }

  function requestLocationChange(newId: string) {
    if (!locked) {
      const nextName = areas.find((a) => a.id === newId)?.name ?? newId;
      setAreaId(newId);
      pushAudit({ action: "CHANGE_LOCATION", details: `To=${nextName}` });
      return;
    }
    setPendingArea(newId);
    openPin("changeLocation");
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
        storage_area_id: areaId,
        par_level: addPar,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Add failed: ${json.error}`);

    setItem(json.item);
    setAddOpen(false);
    setStatus(`Added: ${json.item.name}`);

    pushAudit({
      action: "ADD_ITEM",
      details: `Item=${json.item.name} Barcode=${barcode} Area=${selectedAreaName} Par=${addPar}`,
    });
  }

  async function submit() {
    if (locked) return alert("Locked. Unlock first.");
    if (!staffName.trim()) {
      setTab("Audit");
      return alert("Enter staff name in Audit tab first.");
    }
    if (!item?.id) return alert("Scan an item first.");
    if (!areaId && !mainOverride) return alert("Select a location.");

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        storage_area_id: areaId,
        mode,
        item_id: item.id,
        qty,
        mainOverride,
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Transaction failed: ${json.error}`);

    setMainOverride(false);
    setQty(1);
    setStatus(`✅ Updated on-hand to ${json.on_hand}`);

    pushAudit({
      action: "SUBMIT_TX",
      details: `Mode=${mode} Qty=${qty} Item=${item.name} Area=${selectedAreaName} Override=${mainOverride ? "MAIN" : "NO"}`,
    });
  }

  function savePin(newPin: string) {
    const cleaned = newPin.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length < 4) return alert("PIN must be at least 4 digits.");
    localStorage.setItem(LS.PIN, cleaned);
    alert("PIN saved ✅");
  }

  function onToggleOverride() {
    setMainOverride((v) => {
      const next = !v;
      pushAudit({
        action: next ? "MAIN_OVERRIDE_ON" : "MAIN_OVERRIDE_OFF",
        details: `Area=${selectedAreaName}`,
      });
      return next;
    });
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden flex justify-center">
      <div
        className="w-full max-w-md px-3 pb-6 overflow-x-hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Back */}
        <div className="mt-3 mb-2">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Back
          </button>
        </div>

        {/* Header card */}
        <div className="rounded-3xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
            <div className="min-w-0">
              <div className="text-3xl font-extrabold leading-none">
                Baxter ASC Inventory
              </div>
              <div className="mt-1 text-xs text-white/60">
                Cabinet tracking + building totals + low stock alerts
              </div>
            </div>

            <div className="text-right w-[140px] shrink-0">
              <div className="text-[11px] text-white/60">Location</div>
              <div className="text-sm font-semibold leading-tight break-words">
                {selectedAreaName}
              </div>

              <button
                onClick={() => openPin(locked ? "unlock" : "lock")}
                className="mt-2 w-full rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10 text-sm font-semibold"
              >
                {locked ? "🔒 Locked" : "🔓 Unlocked"}
              </button>
            </div>
          </div>

          {/* Tabs in a grid so no overflow */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <TabBtn active={tab === "Transaction"} onClick={() => setTab("Transaction")}>
              Tx
            </TabBtn>
            <TabBtn active={tab === "Totals"} onClick={() => setTab("Totals")}>
              Totals
            </TabBtn>
            <TabBtn active={tab === "Audit"} onClick={() => setTab("Audit")}>
              Audit
            </TabBtn>
            <TabBtn active={tab === "Settings"} onClick={() => setTab("Settings")}>
              Settings
            </TabBtn>
          </div>
        </div>

        {/* TAB CONTENT */}
        {tab === "Transaction" ? (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
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
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>

            {locked && (
              <div className="mt-2 text-xs text-white/50">
                Locked: PIN required to change location & add items.
              </div>
            )}

            <div className="mt-3 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">One-time override</div>
                  <div className="mt-1 text-sm text-white/70">
                    Grabbed it from MAIN supply room? Tap once.
                  </div>
                </div>
                <button
                  onClick={onToggleOverride}
                  className={[
                    "shrink-0 rounded-2xl px-4 py-3 ring-1",
                    mainOverride
                      ? "bg-white text-black ring-white/20"
                      : "bg-black/40 text-white ring-white/10",
                  ].join(" ")}
                >
                  <div className="text-xs opacity-80">⚡</div>
                  <div className="text-sm font-semibold">
                    MAIN <span className="opacity-70">(1x)</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">Mode</div>
                  <div className="mt-1 text-sm text-white/70">
                    {mode === "USE"
                      ? "Use removes items from on-hand."
                      : "Restock adds items to on-hand."}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <ModeBtn active={mode === "USE"} danger onClick={() => setMode("USE")}>
                    USE
                  </ModeBtn>
                  <ModeBtn active={mode === "RESTOCK"} onClick={() => setMode("RESTOCK")}>
                    RESTOCK
                  </ModeBtn>
                </div>
              </div>
            </div>

            {/* Scan / type */}
            <div className="mt-3">
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

            <div className="mt-2 text-sm text-white/70 break-words">
              {status || "Ready."}
            </div>

            {item && (
              <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-xs text-white/60 break-all">{item.barcode}</div>
              </div>
            )}

            {/* Qty */}
            <div className="mt-3 flex items-center gap-3">
              <QtyBtn onClick={() => setQty((q) => Math.max(1, q - 1))}>−</QtyBtn>
              <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-black">
                <span className="text-lg font-semibold">{qty}</span>
              </div>
              <QtyBtn onClick={() => setQty((q) => q + 1)}>+</QtyBtn>
            </div>

            {/* Submit */}
            <button
              className="mt-3 w-full rounded-2xl bg-black/80 px-4 py-4 text-white font-semibold disabled:opacity-60"
              disabled={!item || locked}
              onClick={submit}
            >
              Submit
            </button>

            {/* Add Item Modal */}
            {addOpen && (
              <Modal
                title="Item not found"
                okText="Add Item"
                onCancel={() => setAddOpen(false)}
                onOk={() => addItemNow()}
              >
                <div className="mt-1 text-sm text-white/70 break-all">
                  Barcode: {query}
                </div>

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
                  <div className="text-xs text-white/60 mb-1">
                    Par level (optional)
                  </div>
                  <input
                    value={String(addPar)}
                    onChange={(e) => setAddPar(Number(e.target.value || 0))}
                    inputMode="numeric"
                    className="w-full rounded-2xl bg-white text-black px-4 py-3"
                    placeholder="0"
                  />
                </div>

                <div className="mt-2 text-xs text-white/50">
                  If locked, you’ll be asked for a PIN before adding.
                </div>
              </Modal>
            )}

            {/* PIN Modal */}
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
                onCancel={() => {
                  setPinOpen(false);
                  setPendingArea("");
                }}
                onOk={onPinConfirm}
              >
                <input
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  className="mt-3 w-full rounded-2xl bg-white text-black px-4 py-3"
                  placeholder="PIN"
                />
                <div className="mt-2 text-xs text-white/50">
                  Default PIN is <span className="font-semibold">1234</span> until set
                  in Settings.
                </div>
              </Modal>
            )}

            {/* ✅ Full-screen scanner */}
            {scannerOpen && (
              <div className="fixed inset-0 z-[60] bg-black">
                <div
                  className="flex items-center justify-between px-4"
                  style={{
                    paddingTop: "calc(env(safe-area-inset-top) + 12px)",
                    paddingBottom: "12px",
                  }}
                >
                  <div className="text-lg font-semibold text-white">
                    Scan barcode
                  </div>
                  <button
                    onClick={closeScanner}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="relative w-full" style={{ height: "calc(100vh - 120px)" }}>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-52 w-80 rounded-2xl ring-2 ring-white/40" />
                  </div>
                </div>

                <div
                  className="px-4 text-xs text-white/70"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
                >
                  Hold the barcode steady inside the box. Best distance: 6–10 inches.
                </div>
              </div>
            )}
          </div>
        ) : tab === "Totals" ? (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-semibold">Totals</div>
            <div className="mt-2 text-sm text-white/70">
              (Next) Pull totals from storage_inventory.
            </div>
          </div>
        ) : tab === "Audit" ? (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 overflow-hidden">
            <div className="text-lg font-semibold">Audit</div>
            <div className="mt-1 text-xs text-white/60">
              Set staff name (saved on this device). Actions are logged below.
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Staff name</div>
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g., Jeremy Johnson"
              />
              <div className="mt-2 text-xs text-white/50">
                Tip: set staff name per device (or later enforce via server-side audit).
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setAudit([]);
                  try {
                    localStorage.removeItem(LS.AUDIT);
                  } catch {}
                }}
                className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/10"
              >
                Clear device log
              </button>
              <button
                onClick={() => {
                  const text = JSON.stringify(audit, null, 2);
                  navigator.clipboard
                    ?.writeText(text)
                    .then(() => alert("Audit log copied ✅"))
                    .catch(() => alert("Copy failed (iOS may block clipboard)."));
                }}
                className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
              >
                Copy log
              </button>
            </div>

            <div className="mt-4 text-sm font-semibold text-white/80">
              Recent events
            </div>

            <div className="mt-2 space-y-2">
              {audit.length === 0 ? (
                <div className="rounded-2xl bg-black/30 p-3 text-sm text-white/60 ring-1 ring-white/10">
                  No audit events yet.
                </div>
              ) : (
                audit.slice(0, 60).map((e) => (
                  <div
                    key={e.id}
                    className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{e.action}</div>
                      <div className="text-[11px] text-white/55">
                        {new Date(e.ts).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      Staff: <span className="font-semibold">{e.staff}</span>
                    </div>
                    {e.details && (
                      <div className="mt-1 text-xs text-white/55 break-words">
                        {e.details}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-semibold">Settings</div>
            <div className="mt-3 text-sm text-white/70">
              Set/Change PIN (min 4 digits):
            </div>
            <PinSetter onSave={savePin} />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
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
      className={[
        "rounded-2xl px-2 py-2 text-xs font-extrabold ring-1",
        active
          ? "bg-white text-black ring-white/20"
          : "bg-white/5 text-white ring-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ModeBtn({ active, danger, onClick, children }: any) {
  const activeCls = danger
    ? "bg-red-600 text-white ring-red-500/30"
    : "bg-white text-black ring-white/20";
  const inactiveCls = "bg-black/30 text-white ring-white/10";
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl px-3 py-2 text-sm font-bold ring-1",
        active ? activeCls : inactiveCls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function QtyBtn({ onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className="h-12 w-12 rounded-2xl bg-white/5 text-white text-xl font-semibold ring-1 ring-white/10"
    >
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
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onOk}
            className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-black"
          >
            {okText}
          </button>
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
      <button
        onClick={() => onSave(pin)}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black"
      >
        Save PIN
      </button>
    </div>
  );
}
