"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrowserMultiFormatReader } from "@zxing/browser";
import { createClient } from "@supabase/supabase-js";

type Tab = "Transaction" | "Totals" | "Audit" | "Settings";
type Mode = "USE" | "RESTOCK";
type LookupMode = "BARCODE" | "REF" | "NAME";

type Area = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  barcode: string;
  reference_number?: string | null;
};

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
    | "UNDO_TX"
    | "CHANGE_LOCATION"
    | "LOCK"
    | "UNLOCK"
    | "MAIN_OVERRIDE_ON"
    | "MAIN_OVERRIDE_OFF"
    | "SCANNER_OPEN"
    | "SCANNER_CLOSE"
    | "TOTALS_SET"
    | "TOTALS_ADJUST"
    | "AREA_LIST_LOAD"
    | "AREA_LIST_TOGGLE";
  details?: string;
};

type BuildingTotalRow = {
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  notes: string | null;
};

type AreaInvRow = {
  storage_area_id: string;
  storage_area_name: string;
  item_id: string;
  item_name: string;
  on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  vendor: string | null;
  category: string | null;
  reference_number: string | null;
  notes: string | null;
};

type LastTx = {
  storage_area_id: string;
  mode: Mode;
  item_id: string;
  qty: number;
  mainOverride: boolean;
  item_name?: string;
  area_name?: string;
  ts: string; // ISO
};

const LS = {
  PIN: "asc_pin_v1",
  LOCKED: "asc_locked_v1",
  AREA: "asc_area_id_v1",
  STAFF: "asc_staff_name_v1",
  AUDIT: "asc_audit_events_v1",
  LAST_TX: "asc_last_tx_v1",
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

// ✅ Client-side Supabase (reads VIEWs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    "unlock" | "lock" | "changeLocation" | "addItem" | "totalsEdit"
  >("unlock");
  const [pinInput, setPinInput] = useState("");
  const [pendingArea, setPendingArea] = useState("");

  const [query, setQuery] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPar, setAddPar] = useState<number>(0);

  // ✅ Lookup controls + matches
  const [lookupMode, setLookupMode] = useState<LookupMode>("BARCODE");
  const [matches, setMatches] = useState<Item[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // ✅ Audit + staff
  const [staffName, setStaffName] = useState("");
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  // ✅ Full-screen scanner overlay
  const [scannerOpen, setScannerOpen] = useState(false);

  // ✅ Totals tab state (building view)
  const [totals, setTotals] = useState<BuildingTotalRow[]>([]);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsError, setTotalsError] = useState("");
  const [totalsSearch, setTotalsSearch] = useState("");
  const [totalsLowOnly, setTotalsLowOnly] = useState(false);

  // ✅ Totals edit modal
  const [totalsEditOpen, setTotalsEditOpen] = useState(false);
  const [totalsEditRow, setTotalsEditRow] = useState<BuildingTotalRow | null>(
    null
  );
  const [setOnHandInput, setSetOnHandInput] = useState<string>("");
  const [deltaInput, setDeltaInput] = useState<string>("");
  const [parInput, setParInput] = useState<string>("");

  // pending totals action gated by PIN (if locked)
  const [pendingTotalsAction, setPendingTotalsAction] = useState<
    null | { kind: "SET"; value: number } | { kind: "ADJUST"; delta: number }
  >(null);

  // ✅ Area List (per selected storage area)
  const [areaListOpen, setAreaListOpen] = useState(false);
  const [areaInv, setAreaInv] = useState<AreaInvRow[]>([]);
  const [areaInvLoading, setAreaInvLoading] = useState(false);
  const [areaInvError, setAreaInvError] = useState("");
  const [areaInvSearch, setAreaInvSearch] = useState("");
  const [areaParOnly, setAreaParOnly] = useState(true);
  const [areaLowOnly, setAreaLowOnly] = useState(false);

  // ✅ Last transaction for UNDO (device-only)
  const [lastTx, setLastTx] = useState<LastTx | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  const filteredTotals = useMemo(() => {
    const q = totalsSearch.trim().toLowerCase();
    let list = totals;

    if (q) {
      list = list.filter((r) => {
        return (
          (r.name || "").toLowerCase().includes(q) ||
          (r.vendor || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q) ||
          (r.reference_number || "").toLowerCase().includes(q)
        );
      });
    }

    if (totalsLowOnly) {
      list = list.filter((r) => {
        const onHand = r.total_on_hand ?? 0;
        const low = r.low_level ?? 0;
        return low > 0 && onHand <= low;
      });
    }

    return list;
  }, [totals, totalsSearch, totalsLowOnly]);

  const filteredAreaInv = useMemo(() => {
    const q = areaInvSearch.trim().toLowerCase();
    let list = areaInv;

    if (q) {
      list = list.filter((r) => {
        return (
          (r.item_name || "").toLowerCase().includes(q) ||
          (r.vendor || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q) ||
          (r.reference_number || "").toLowerCase().includes(q)
        );
      });
    }

    if (areaParOnly) {
      list = list.filter((r) => (r.par_level ?? 0) > 0);
    }

    if (areaLowOnly) {
      list = list.filter((r) => {
        const onHand = r.on_hand ?? 0;
        const low = r.low_level ?? 0;
        return low > 0 && onHand <= low;
      });
    }

    return list;
  }, [areaInv, areaInvSearch, areaParOnly, areaLowOnly]);

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

      const savedLastTx = safeJsonParse<LastTx | null>(
        localStorage.getItem(LS.LAST_TX),
        null
      );
      setLastTx(savedLastTx);
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

  useEffect(() => {
    try {
      localStorage.setItem(LS.LAST_TX, JSON.stringify(lastTx));
    } catch {}
  }, [lastTx]);

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

  // ---------- LOAD LOCATIONS (REFRESHABLE) ----------
  async function loadLocations() {
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
  }

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "Transaction") loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---------- LOAD TOTALS (when tab opens) ----------
  async function loadTotals() {
    setTotalsLoading(true);
    setTotalsError("");

    try {
      const { data, error } = await supabase
        .from("building_inventory_sheet_view")
        .select(
          "name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit,notes"
        )
        .order("name", { ascending: true });

      if (error) throw error;

      setTotals((data as BuildingTotalRow[]) ?? []);
    } catch (e: any) {
      setTotals([]);
      setTotalsError(e?.message ?? "Failed to load totals");
    } finally {
      setTotalsLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "Totals") return;
    loadTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---------- LOAD AREA INVENTORY (Tx tab, when opened / area changes) ----------
  async function loadAreaInventory() {
    if (!areaId) return;

    setAreaInvLoading(true);
    setAreaInvError("");

    try {
      const { data, error } = await supabase
        .from("storage_inventory_area_view")
        .select(
          "storage_area_id,storage_area_name,item_id,item_name,on_hand,par_level,low_level,unit,vendor,category,reference_number,notes"
        )
        .eq("storage_area_id", areaId)
        .order("item_name", { ascending: true });

      if (error) throw error;

      setAreaInv((data as AreaInvRow[]) ?? []);
      pushAudit({
        action: "AREA_LIST_LOAD",
        details: `Area=${selectedAreaName} Rows=${(data as any[])?.length ?? 0}`,
      });
    } catch (e: any) {
      setAreaInv([]);
      setAreaInvError(e?.message ?? "Failed to load area list");
    } finally {
      setAreaInvLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "Transaction") return;
    if (!areaListOpen) return;
    if (!areaId) return;
    loadAreaInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, areaListOpen, areaId]);

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

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const v: any = videoRef.current;
      v.srcObject = stream;
      await v.play();

      const decodeFromVideoElement = (reader as any).decodeFromVideoElement?.bind(
        reader
      );

      const handleText = async (text: string) => {
        if (!text) return;
        const now = Date.now();
        if (now < scanCooldownRef.current) return;
        scanCooldownRef.current = now + 900;

        if (text === lastScanRef.current) return;
        lastScanRef.current = text;

        setQuery(text);

        stopScanner();
        setScannerOpen(false);

        setLookupMode("BARCODE");
        await lookup(text);
      };

      if (decodeFromVideoElement) {
        await decodeFromVideoElement(videoRef.current, async (result: any) => {
          if (!result) return;
          const text = result.getText?.() ?? "";
          await handleText(text);
        });
      } else {
        await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result) => {
            if (!result) return;
            const text = result.getText?.() ?? "";
            await handleText(text);
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

  // ---------- LOOKUP / SUGGEST / ADD / SUBMIT ----------
  function mapItemRow(r: any): Item {
    return {
      id: r.id,
      name: r.name,
      barcode: r.barcode ?? "",
      reference_number: r.reference_number ?? null,
    };
  }

  async function lookup(queryRaw: string) {
    const q = queryRaw.trim();
    if (!q) return;

    setItem(null);
    setMatches([]);
    setStatus("Looking up…");

    const res = await fetch("/api/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ query: q, mode: lookupMode }),
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(`Lookup failed: ${json.error}`);
      return;
    }

    if (json.item) {
      const it = mapItemRow(json.item);
      setItem(it);
      setStatus(`Found: ${it.name}`);
      pushAudit({
        action: "LOOKUP_FOUND",
        details: `Item=${it.name} Mode=${lookupMode} Query=${q}`,
      });
      return;
    }

    const list = (json.matches ?? []) as any[];
    const mapped = list.map(mapItemRow);

    if (mapped.length) {
      setMatches(mapped);
      setStatus("Multiple matches — tap one.");
      return;
    }

    setStatus("NOT FOUND — Add Item");
    pushAudit({
      action: "LOOKUP_NOT_FOUND",
      details: `Mode=${lookupMode} Query=${q}`,
    });
    setAddOpen(true);
    setAddName("");
  }

  async function suggest(queryRaw: string) {
    const q = queryRaw.trim();
    if (!q) {
      setMatches([]);
      setSuggestLoading(false);
      return;
    }

    if (lookupMode === "BARCODE") {
      setMatches([]);
      setSuggestLoading(false);
      return;
    }

    if (q.length < 2) {
      setMatches([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);

    try {
      const res = await fetch("/api/items/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ query: q, mode: lookupMode, suggest: true }),
      });

      const json = await res.json();

      if (!json.ok) {
        setMatches([]);
        setSuggestLoading(false);
        return;
      }

      if (json.item) {
        const it = mapItemRow(json.item);
        setMatches([it]);
        setSuggestLoading(false);
        return;
      }

      const list = (json.matches ?? []) as any[];
      const mapped = list.map(mapItemRow);
      setMatches(mapped.slice(0, 8));
    } catch {
      setMatches([]);
    } finally {
      setSuggestLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "Transaction") return;
    if (areaListOpen) return;
    if (scannerOpen) return;
    if (addOpen) return;

    if (lookupMode === "BARCODE") {
      setSuggestLoading(false);
      return;
    }

    const q = query.trim();

    const t = window.setTimeout(() => {
      suggest(q);
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lookupMode, tab, areaListOpen, scannerOpen, addOpen]);

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

    if (pinPurpose === "totalsEdit") {
      const action = pendingTotalsAction;
      setPendingTotalsAction(null);
      if (!action || !totalsEditRow) return;

      if (action.kind === "SET") {
        await doTotalsSet(totalsEditRow, action.value, true);
      } else {
        await doTotalsAdjust(totalsEditRow, action.delta, true);
      }
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
    if (!barcode) return alert("No barcode/value entered.");
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

    setItem(mapItemRow(json.item));
    setMatches([]);

    setAddOpen(false);
    setStatus(`Added: ${json.item.name}`);

    pushAudit({
      action: "ADD_ITEM",
      details: `Item=${json.item.name} Barcode=${barcode} Area=${selectedAreaName} Par=${addPar}`,
    });
  }

  function inverseMode(m: Mode): Mode {
    return m === "USE" ? "RESTOCK" : "USE";
  }

  async function submit() {
    if (locked) return alert("Locked. Unlock first.");
    if (!staffName.trim()) {
      setTab("Audit");
      return alert("Enter staff name in Audit tab first.");
    }
    if (!item?.id) return alert("Find or scan an item first.");
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
        staff: staffName.trim(), // harmless even if server ignores
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Transaction failed: ${json.error}`);

    // Save lastTx for UNDO
    const tx: LastTx = {
      storage_area_id: areaId,
      mode,
      item_id: item.id,
      qty,
      mainOverride,
      item_name: item.name,
      area_name: selectedAreaName,
      ts: nowIso(),
    };
    setLastTx(tx);

    // Reset one-time override & qty
    setMainOverride(false);
    setQty(1);
    setStatus(`✅ Updated on-hand to ${json.on_hand}`);

    // keep lists fresh
    if (tab === "Totals") await loadTotals();
    if (tab === "Transaction" && areaListOpen) await loadAreaInventory();

    pushAudit({
      action: "SUBMIT_TX",
      details: `Mode=${mode} Qty=${qty} Item=${item.name} Area=${selectedAreaName} Override=${
        mainOverride ? "MAIN" : "NO"
      }`,
    });
  }

  async function undoLast() {
    if (!lastTx) return;
    if (undoBusy) return;
    if (locked) return alert("Locked. Unlock first.");
    if (!staffName.trim()) {
      setTab("Audit");
      return alert("Enter staff name in Audit tab first.");
    }

    const ok = confirm(
      `UNDO last transaction?\n\n${lastTx.mode} x${lastTx.qty}\n${lastTx.item_name ?? lastTx.item_id}\nArea: ${
        lastTx.area_name ?? lastTx.storage_area_id
      }\nMAIN override: ${lastTx.mainOverride ? "YES" : "NO"}`
    );
    if (!ok) return;

    setUndoBusy(true);
    try {
      // We reverse by calling a dedicated undo endpoint that uses your same apply logic.
      const res = await fetch("/api/transaction/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          storage_area_id: lastTx.storage_area_id,
          mode: inverseMode(lastTx.mode),
          item_id: lastTx.item_id,
          qty: lastTx.qty,
          mainOverride: lastTx.mainOverride,
          staff: staffName.trim(),
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        alert(`Undo failed: ${json.error}`);
        return;
      }

      setStatus(`↩️ UNDONE. On-hand now ${json.on_hand}`);

      pushAudit({
        action: "UNDO_TX",
        details: `Reversed=${lastTx.mode} Qty=${lastTx.qty} Item=${
          lastTx.item_name ?? lastTx.item_id
        } Area=${lastTx.area_name ?? lastTx.storage_area_id}`,
      });

      // After successful undo, clear lastTx so they can't double-undo
      setLastTx(null);

      // refresh lists if open
      if (tab === "Totals") await loadTotals();
      if (tab === "Transaction" && areaListOpen) await loadAreaInventory();
    } finally {
      setUndoBusy(false);
    }
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

  // ---------- TOTALS EDIT ----------
  function openTotalsEditor(row: BuildingTotalRow) {
    setTotalsEditRow(row);
    setSetOnHandInput(String(row.total_on_hand ?? 0));
    setDeltaInput("");
    setParInput(String(row.par_level ?? 0));
    setTotalsEditOpen(true);
  }

  function parseIntSafe(raw: string): number | null {
    const cleaned = raw.trim();
    if (!cleaned) return null;
    if (!/^-?\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  async function doTotalsSet(
    row: BuildingTotalRow,
    value: number,
    pinAlreadyPassed = false
  ) {
    if (!staffName.trim()) {
      setTab("Audit");
      alert("Enter staff name in Audit tab first.");
      return;
    }

    if (locked && !pinAlreadyPassed) {
      setPendingTotalsAction({ kind: "SET", value });
      openPin("totalsEdit");
      return;
    }

    const res = await fetch("/api/building-inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        name: row.name,
        action: "SET",
        value,
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      alert(`Update failed: ${json.error}`);
      return;
    }

    pushAudit({
      action: "TOTALS_SET",
      details: `Item=${row.name} Set=${value}`,
    });

    setTotalsEditOpen(false);
    await loadTotals();
  }

  async function doTotalsAdjust(
    row: BuildingTotalRow,
    delta: number,
    pinAlreadyPassed = false
  ) {
    if (!staffName.trim()) {
      setTab("Audit");
      alert("Enter staff name in Audit tab first.");
      return;
    }

    if (delta === 0) {
      alert("Delta cannot be 0.");
      return;
    }

    if (locked && !pinAlreadyPassed) {
      setPendingTotalsAction({ kind: "ADJUST", delta });
      openPin("totalsEdit");
      return;
    }

    const res = await fetch("/api/building-inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        name: row.name,
        action: "ADJUST",
        delta,
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      alert(`Update failed: ${json.error}`);
      return;
    }

    pushAudit({
      action: "TOTALS_ADJUST",
      details: `Item=${row.name} Delta=${delta > 0 ? "+" : ""}${delta}`,
    });

    setTotalsEditOpen(false);
    await loadTotals();
  }

  // ---------- UI ----------
  const staffMissing = !staffName.trim();

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden flex justify-center">
      <div
        className="w-full max-w-md px-3 pb-6 overflow-x-hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mt-3 mb-2">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Back
          </button>
        </div>

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

            <div className="text-right w-[160px] shrink-0">
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

          <div className="mt-3 grid grid-cols-4 gap-2">
            <TabBtn
              active={tab === "Transaction"}
              onClick={() => setTab("Transaction")}
            >
              Tx
            </TabBtn>
            <TabBtn active={tab === "Totals"} onClick={() => setTab("Totals")}>
              Totals
            </TabBtn>
            <TabBtn active={tab === "Audit"} onClick={() => setTab("Audit")}>
              Audit
            </TabBtn>
            <TabBtn
              active={tab === "Settings"}
              onClick={() => setTab("Settings")}
            >
              Settings
            </TabBtn>
          </div>
        </div>

        {tab === "Transaction" ? (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            {/* Staff warning banner */}
            {staffMissing && (
              <div className="mb-3 rounded-2xl bg-red-600/20 p-3 ring-1 ring-red-500/30">
                <div className="text-sm font-extrabold text-red-200">
                  Staff name required
                </div>
                <div className="mt-1 text-xs text-red-100/80">
                  Go to the Audit tab and set the staff name for this device.
                </div>
                <button
                  onClick={() => setTab("Audit")}
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-black"
                >
                  Go to Audit
                </button>
              </div>
            )}

            <div className="text-sm text-white/70">Select location</div>

            {/* Location: read-only when locked */}
            {locked ? (
              <div className="mt-2 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Locked to:</div>
                <div className="text-sm font-semibold break-words">
                  {selectedAreaName}
                </div>
                <div className="mt-1 text-[11px] text-white/50">
                  Unlock to change location.
                </div>
              </div>
            ) : (
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
            )}

            {locked && (
              <div className="mt-2 text-xs text-white/50">
                Locked: PIN required to unlock and change location.
              </div>
            )}

            {/* Toggle between Scan mode and Area List */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setAreaListOpen(false);
                  pushAudit({ action: "AREA_LIST_TOGGLE", details: "SCAN" });
                }}
                className={[
                  "rounded-2xl px-4 py-3 font-extrabold ring-1 text-sm",
                  !areaListOpen
                    ? "bg-white text-black ring-white/20"
                    : "bg-white/10 text-white ring-white/10",
                ].join(" ")}
              >
                SCAN MODE
              </button>
              <button
                onClick={() => {
                  setAreaListOpen(true);
                  pushAudit({
                    action: "AREA_LIST_TOGGLE",
                    details: `AREA_LIST Area=${selectedAreaName}`,
                  });
                }}
                className={[
                  "rounded-2xl px-4 py-3 font-extrabold ring-1 text-sm",
                  areaListOpen
                    ? "bg-white text-black ring-white/20"
                    : "bg-white/10 text-white ring-white/10",
                ].join(" ")}
              >
                AREA LIST
              </button>
            </div>

            {/* Area List Panel */}
            {areaListOpen ? (
              <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{selectedAreaName}</div>
                  <div className="text-xs text-white/60">
                    {areaInvLoading ? "Loading…" : `${areaInv.length} rows`}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAreaParOnly((v) => !v)}
                    className={[
                      "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                      areaParOnly
                        ? "bg-white text-black ring-white/20"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    PAR: {areaParOnly ? "ONLY" : "ALL"}
                  </button>

                  <button
                    onClick={() => setAreaLowOnly((v) => !v)}
                    className={[
                      "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                      areaLowOnly
                        ? "bg-red-600 text-white ring-red-500/30"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    LOW: {areaLowOnly ? "ONLY" : "ALL"}
                  </button>

                  <button
                    onClick={() => loadAreaInventory()}
                    className="rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold ring-1 ring-white/10"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-2">
                  <input
                    value={areaInvSearch}
                    onChange={(e) => setAreaInvSearch(e.target.value)}
                    placeholder="Search item/vendor/category…"
                    className="w-full rounded-2xl bg-white text-black px-4 py-3"
                  />
                </div>

                {areaInvError && (
                  <div className="mt-2 text-sm text-red-300 break-words">
                    {areaInvError}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {filteredAreaInv.slice(0, 200).map((r) => {
                    const onHand = r.on_hand ?? 0;
                    const par = r.par_level ?? 0;
                    const low = r.low_level ?? 0;
                    const isLow = low > 0 && onHand <= low;

                    return (
                      <div
                        key={`${r.storage_area_id}-${r.item_id}`}
                        className="w-full rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold break-words">
                              {r.item_name}
                            </div>
                            <div className="mt-1 text-xs text-white/60 break-words">
                              {r.vendor ?? "—"} • {r.category ?? "—"}{" "}
                              {r.reference_number
                                ? `• ${r.reference_number}`
                                : ""}
                            </div>
                          </div>

                          <div
                            className={[
                              "shrink-0 rounded-2xl px-3 py-2 text-sm font-extrabold ring-1",
                              isLow
                                ? "bg-red-600 text-white ring-red-500/30"
                                : "bg-white/10 text-white ring-white/10",
                            ].join(" ")}
                          >
                            {onHand}
                            <div className="text-[10px] font-semibold opacity-80">
                              on hand
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                            <div className="text-white/60">Par</div>
                            <div className="font-semibold">{par}</div>
                          </div>
                          <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                            <div className="text-white/60">Low</div>
                            <div className="font-semibold">{low}</div>
                          </div>
                          <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                            <div className="text-white/60">Unit</div>
                            <div className="font-semibold">
                              {r.unit ?? "—"}
                            </div>
                          </div>
                        </div>

                        {r.notes && (
                          <div className="mt-2 text-[11px] text-white/60 break-words">
                            Notes: {r.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-[11px] text-white/50">
                  Showing up to 200 rows to keep it fast on phones.
                </div>
              </div>
            ) : (
              <>
                {/* Override */}
                <div className="mt-3 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">
                        One-time override
                      </div>
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

                {/* MAIN override banner + cancel */}
                {mainOverride && (
                  <div className="mt-3 rounded-2xl bg-yellow-500/20 p-3 ring-1 ring-yellow-500/30">
                    <div className="text-sm font-extrabold text-yellow-200">
                      ⚡ MAIN OVERRIDE ACTIVE (1 transaction)
                    </div>
                    <div className="mt-1 text-xs text-yellow-100/80">
                      This submit will be treated as pulled from MAIN supply
                      room.
                    </div>
                    <button
                      onClick={() => setMainOverride(false)}
                      className="mt-2 w-full rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-black"
                    >
                      Cancel MAIN Override
                    </button>
                  </div>
                )}

                {/* Mode */}
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
                      <ModeBtn
                        active={mode === "USE"}
                        danger
                        onClick={() => setMode("USE")}
                      >
                        USE
                      </ModeBtn>
                      <ModeBtn
                        active={mode === "RESTOCK"}
                        onClick={() => setMode("RESTOCK")}
                      >
                        RESTOCK
                      </ModeBtn>
                    </div>
                  </div>
                </div>

                {/* EASY LOOKUP: Toggle + Input + Find + Camera */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setLookupMode("BARCODE");
                      setMatches([]);
                    }}
                    className={[
                      "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                      lookupMode === "BARCODE"
                        ? "bg-white text-black ring-white/20"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    BARCODE
                  </button>
                  <button
                    onClick={() => {
                      setLookupMode("REF");
                      setMatches([]);
                    }}
                    className={[
                      "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                      lookupMode === "REF"
                        ? "bg-white text-black ring-white/20"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    REF #
                  </button>
                  <button
                    onClick={() => {
                      setLookupMode("NAME");
                      setMatches([]);
                    }}
                    className={[
                      "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                      lookupMode === "NAME"
                        ? "bg-white text-black ring-white/20"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    NAME
                  </button>
                </div>

                <div className="mt-2 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setStatus("");
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          await lookup(query);
                        }
                      }}
                      placeholder={
                        lookupMode === "BARCODE"
                          ? "Scan or type barcode"
                          : lookupMode === "REF"
                          ? "Type reference number"
                          : "Type item name"
                      }
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

                  <button
                    onClick={async () => await lookup(query)}
                    className="rounded-2xl bg-white px-4 py-3 font-extrabold text-black"
                  >
                    Find
                  </button>
                </div>

                {/* Suggestions */}
                {lookupMode !== "BARCODE" && (
                  <div className="mt-2 text-[11px] text-white/55">
                    {suggestLoading
                      ? "Searching…"
                      : matches.length
                      ? "Suggestions:"
                      : query.trim().length >= 2
                      ? "No suggestions yet (press Find to search fully)."
                      : "Type 2+ characters for suggestions."}
                  </div>
                )}

                {matches.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {matches.slice(0, 8).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setItem(m);
                          setMatches([]);
                          setStatus(`Selected: ${m.name}`);
                        }}
                        className="w-full text-left rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
                      >
                        <div className="text-sm font-semibold break-words">
                          {m.name}
                        </div>
                        <div className="mt-1 text-xs text-white/60 break-words">
                          {m.reference_number
                            ? `Ref: ${m.reference_number}`
                            : "Ref: —"}
                          {" • "}
                          {m.barcode ? `Barcode: ${m.barcode}` : "Barcode: —"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2 text-sm text-white/70 break-words">
                  {status || "Ready."}
                </div>

                {item && (
                  <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs text-white/60 break-words">
                      {item.reference_number ? `Ref: ${item.reference_number}` : ""}
                      {item.reference_number && item.barcode ? " • " : ""}
                      {item.barcode ? `Barcode: ${item.barcode}` : ""}
                    </div>
                  </div>
                )}

                {/* Qty */}
                <div className="mt-3 flex items-center gap-3">
                  <QtyBtn onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    −
                  </QtyBtn>
                  <div className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-black">
                    <span className="text-lg font-semibold">{qty}</span>
                  </div>
                  <QtyBtn onClick={() => setQty((q) => q + 1)}>+</QtyBtn>
                </div>

                {/* Submit */}
                <button
                  className="mt-3 w-full rounded-2xl bg-black/80 px-4 py-4 text-white font-semibold disabled:opacity-60"
                  disabled={!item || locked || staffMissing}
                  onClick={submit}
                >
                  Submit
                </button>

                {/* UNDO last */}
                <button
                  className="mt-2 w-full rounded-2xl bg-white/10 px-4 py-3 text-white font-extrabold ring-1 ring-white/10 disabled:opacity-60"
                  disabled={!lastTx || locked || staffMissing || undoBusy}
                  onClick={undoLast}
                >
                  {undoBusy ? "Undoing…" : "↩️ Undo last transaction"}
                </button>

                {lastTx && (
                  <div className="mt-2 text-[11px] text-white/55 break-words">
                    Last: {lastTx.mode} x{lastTx.qty} •{" "}
                    {lastTx.item_name ?? lastTx.item_id} •{" "}
                    {lastTx.area_name ?? lastTx.storage_area_id}
                    {lastTx.mainOverride ? " • MAIN" : ""}
                  </div>
                )}

                {/* Add Item Modal */}
                {addOpen && (
                  <Modal
                    title="Item not found"
                    okText="Add Item"
                    onCancel={() => setAddOpen(false)}
                    onOk={() => addItemNow()}
                  >
                    <div className="mt-1 text-sm text-white/70 break-all">
                      Entered: {query}
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
              </>
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
                    : pinPurpose === "addItem"
                    ? "Enter PIN to add item"
                    : "Enter PIN to edit totals"
                }
                okText="OK"
                onCancel={() => {
                  setPinOpen(false);
                  setPendingArea("");
                  setPendingTotalsAction(null);
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
                  Default PIN is <span className="font-semibold">1234</span>{" "}
                  until set in Settings.
                </div>
              </Modal>
            )}

            {/* Full-screen scanner */}
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

                <div
                  className="relative w-full"
                  style={{ height: "calc(100vh - 120px)" }}
                >
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
                  style={{
                    paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
                  }}
                >
                  Hold the barcode steady inside the box. Best distance: 6–10
                  inches.
                </div>
              </div>
            )}
          </div>
        ) : tab === "Totals" ? (
          <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="text-lg font-semibold">Building Totals</div>
              <div className="text-xs text-white/60">
                {totalsLoading ? "Loading…" : `${totals.length} items`}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={totalsSearch}
                onChange={(e) => setTotalsSearch(e.target.value)}
                placeholder="Search name, vendor, category…"
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
              />
              <button
                onClick={() => setTotalsLowOnly((v) => !v)}
                className={[
                  "rounded-2xl px-4 py-3 font-extrabold ring-1 text-sm",
                  totalsLowOnly
                    ? "bg-red-600 text-white ring-red-500/30"
                    : "bg-white/10 text-white ring-white/10",
                ].join(" ")}
              >
                {totalsLowOnly ? "LOW ONLY" : "ALL ITEMS"}
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={loadTotals}
                className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/10"
              >
                Refresh
              </button>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/10"
              >
                ↑
              </button>
            </div>

            {totalsError && (
              <div className="mt-2 text-sm text-red-300 break-words">
                {totalsError}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {filteredTotals.slice(0, 200).map((r) => {
                const onHand = r.total_on_hand ?? 0;
                const low = r.low_level ?? 0;
                const isLow = low > 0 && onHand <= low;

                return (
                  <button
                    key={`${r.name}-${r.reference_number ?? ""}`}
                    onClick={() => openTotalsEditor(r)}
                    className="w-full text-left rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold break-words">
                          {r.name}
                        </div>
                        <div className="mt-1 text-xs text-white/60 break-words">
                          {r.vendor ?? "—"} • {r.category ?? "—"}{" "}
                          {r.reference_number ? `• ${r.reference_number}` : ""}
                        </div>
                      </div>

                      <div
                        className={[
                          "shrink-0 rounded-2xl px-3 py-2 text-sm font-extrabold ring-1",
                          isLow
                            ? "bg-red-600 text-white ring-red-500/30"
                            : "bg-white/10 text-white ring-white/10",
                        ].join(" ")}
                      >
                        {onHand}
                        <div className="text-[10px] font-semibold opacity-80">
                          on hand
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                        <div className="text-white/60">Par</div>
                        <div className="font-semibold">{r.par_level ?? 0}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                        <div className="text-white/60">Low</div>
                        <div className="font-semibold">{r.low_level ?? 0}</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                        <div className="text-white/60">Unit</div>
                        <div className="font-semibold">{r.unit ?? "—"}</div>
                      </div>
                    </div>

                    {r.notes && (
                      <div className="mt-2 text-[11px] text-white/60 break-words">
                        Notes: {r.notes}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-white/50">
                      Tap to edit on-hand + PAR
                      {locked ? " (PIN required for totals updates)" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] text-white/50">
              Showing up to 200 rows to keep it fast on phones.
            </div>

            {totalsEditOpen && totalsEditRow && (
              <Modal
                title="Edit building totals"
                okText="Close"
                onCancel={() => setTotalsEditOpen(false)}
                onOk={() => setTotalsEditOpen(false)}
              >
                <div className="mt-1 text-sm text-white/80 break-words">
                  <div className="font-semibold">{totalsEditRow.name}</div>
                  <div className="text-xs text-white/60">
                    {totalsEditRow.vendor ?? "—"} •{" "}
                    {totalsEditRow.category ?? "—"}{" "}
                    {totalsEditRow.reference_number
                      ? `• ${totalsEditRow.reference_number}`
                      : ""}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-sm font-semibold">Set PAR level</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={parInput}
                      onChange={(e) =>
                        setParInput(e.target.value.replace(/[^\d]/g, ""))
                      }
                      inputMode="numeric"
                      className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
                      placeholder="e.g., 30"
                    />
                    <button
                      onClick={async () => {
                        const n = parseIntSafe(parInput);
                        if (n === null || n < 0)
                          return alert("Enter a valid PAR (0 or more).");

                        const res = await fetch(
                          "/api/building-inventory/update",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            cache: "no-store",
                            body: JSON.stringify({
                              name: totalsEditRow.name,
                              action: "SET_PAR",
                              par_level: n,
                            }),
                          }
                        );

                        const json = await res.json();
                        if (!json.ok)
                          return alert(`PAR update failed: ${json.error}`);

                        pushAudit({
                          action: "TOTALS_ADJUST",
                          details: `PAR Set Item=${totalsEditRow.name} Par=${n}`,
                        });

                        setTotalsEditOpen(false);
                        await loadTotals();
                      }}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
                    >
                      Set PAR
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-white/55">
                    PAR is stored in{" "}
                    <span className="font-semibold">items.par_level</span>.
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-sm font-semibold">Set exact on-hand</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={setOnHandInput}
                      onChange={(e) =>
                        setSetOnHandInput(e.target.value.replace(/[^\d]/g, ""))
                      }
                      inputMode="numeric"
                      className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
                      placeholder="e.g., 17"
                    />
                    <button
                      onClick={async () => {
                        const n = parseIntSafe(setOnHandInput);
                        if (n === null || n < 0)
                          return alert("Enter a valid number (0 or more).");
                        await doTotalsSet(totalsEditRow, n);
                      }}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
                    >
                      Set
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-white/55">
                    Best for cycle counts (truth).
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-sm font-semibold">Adjust + / −</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const cur = parseIntSafe(deltaInput) ?? 0;
                        setDeltaInput(String(cur - 1));
                      }}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
                    >
                      −1
                    </button>
                    <input
                      value={deltaInput}
                      onChange={(e) =>
                        setDeltaInput(
                          e.target.value
                            .replace(/[^\d-]/g, "")
                            .slice(0, 7)
                        )
                      }
                      inputMode="numeric"
                      className="rounded-2xl bg-white text-black px-4 py-3 text-center"
                      placeholder="e.g., +5"
                    />
                    <button
                      onClick={() => {
                        const cur = parseIntSafe(deltaInput) ?? 0;
                        setDeltaInput(String(cur + 1));
                      }}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
                    >
                      +1
                    </button>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        const d = parseIntSafe(deltaInput);
                        if (d === null) return alert("Enter a valid delta.");
                        await doTotalsAdjust(totalsEditRow, d);
                      }}
                      className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
                    >
                      Apply delta
                    </button>
                    <button
                      onClick={() => setDeltaInput("")}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/10"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] text-white/55">
                    Best for quick receiving corrections.
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-white/50">
                  Locked devices require PIN before saving totals actions.
                </div>
              </Modal>
            )}
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
                Tip: staff name is per device for now.
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
