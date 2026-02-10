"use client";

import React, { useEffect, useMemo, useState } from "react";

type Location = { id: string; name: string; active?: boolean };

const VERSION = "LOCK-PIN v4 + One-time Main Supply Override";

const LS_LOCKED = "asc_lock_isLocked";
const LS_LOCKED_LOC = "asc_lock_locationId";
const LS_MASTER_PIN = "asc_lock_masterPin";

// ✅ CHANGE THIS to match EXACTLY what your location is named in Supabase
const MAIN_SUPPLY_NAME = "Main Sterile Supply";

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}
function lsSet(key: string, value: string) {
  window.localStorage.setItem(key, value);
}
function lsRemove(key: string) {
  window.localStorage.removeItem(key);
}

function getMasterPin(): string {
  const pin = lsGet(LS_MASTER_PIN);
  return pin && pin.trim().length > 0 ? pin.trim() : "1234";
}

export default function Page() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const [locationId, setLocationId] = useState<string>("");
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [code, setCode] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("");

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedLocationId, setLockedLocationId] = useState<string>("");

  // ✅ One-time override
  const [useMainSupplyOnce, setUseMainSupplyOnce] = useState<boolean>(false);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId) || null,
    [locations, locationId]
  );

  const lockedLocation = useMemo(
    () => locations.find((l) => l.id === lockedLocationId) || null,
    [locations, lockedLocationId]
  );

  const mainSupplyLocation = useMemo(() => {
    const target = MAIN_SUPPLY_NAME.trim().toLowerCase();
    return locations.find((l) => l.name.trim().toLowerCase() === target) || null;
  }, [locations]);

  // Load locations
  useEffect(() => {
    (async () => {
      try {
        setLoadingLocations(true);
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const json = await res.json();

        const list: Location[] =
          json?.storage_areas ??
          json?.locations ??
          json?.data ??
          (Array.isArray(json) ? json : []);

        setLocations(list);

        if (!locationId && list.length > 0) {
          const first = list.find((x) => x.active) ?? list[0];
          setLocationId(first.id);
        }
      } catch (e: any) {
        console.error(e);
        setStatus(`ERROR: Failed to load locations. ${e?.message ?? ""}`);
        setLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore lock on load
  useEffect(() => {
    const savedLocked = lsGet(LS_LOCKED) === "true";
    const savedLoc = lsGet(LS_LOCKED_LOC) || "";

    if (savedLocked && savedLoc) {
      setIsLocked(true);
      setLockedLocationId(savedLoc);
      setLocationId(savedLoc);
      setStatus(`Restored lock to location: ${savedLoc}`);
    }
  }, []);

  function lockNow() {
    if (!locationId) {
      setStatus("ERROR: Pick a location first.");
      return;
    }
    setIsLocked(true);
    setLockedLocationId(locationId);
    lsSet(LS_LOCKED, "true");
    lsSet(LS_LOCKED_LOC, locationId);
    setStatus(`Locked to: ${selectedLocation?.name ?? locationId}`);
  }

  function unlockNow() {
    const pin = window.prompt("Enter master PIN to unlock:");
    if (pin === null) return;
    if (pin.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong PIN. Still locked.");
      return;
    }
    setIsLocked(false);
    setLockedLocationId("");
    lsSet(LS_LOCKED, "false");
    lsRemove(LS_LOCKED_LOC);
    setStatus("Unlocked.");
  }

  function changePin() {
    const current = window.prompt("Enter CURRENT master PIN:");
    if (current === null) return;
    if (current.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong current PIN.");
      return;
    }
    const next = window.prompt("Enter NEW master PIN (4+ digits):");
    if (next === null) return;
    const cleaned = next.trim();
    if (cleaned.length < 4) {
      setStatus("ERROR: PIN too short.");
      return;
    }
    lsSet(LS_MASTER_PIN, cleaned);
    setStatus("Master PIN updated.");
  }

  // Location change guard
  function requestLocationChange(nextId: string) {
    if (!isLocked) {
      setLocationId(nextId);
      return;
    }
    if (nextId === lockedLocationId) return;

    const pin = window.prompt("Location is LOCKED. Enter master PIN to change location:");
    if (pin === null) return;

    if (pin.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong PIN. Location not changed.");
      setLocationId(lockedLocationId);
      return;
    }

    // Correct PIN: change locked location to the new one
    setLocationId(nextId);
    setLockedLocationId(nextId);
    lsSet(LS_LOCKED, "true");
    lsSet(LS_LOCKED_LOC, nextId);
    setStatus("Location changed (PIN accepted) and still locked.");
  }

  // ✅ One-time Main Supply override button
  function requestMainSupplyOnce() {
    if (!mainSupplyLocation) {
      setStatus(`ERROR: Main supply location "${MAIN_SUPPLY_NAME}" not found.`);
      return;
    }

    const pin = window.prompt(`Enter PIN to pull from "${mainSupplyLocation.name}" (ONE TIME):`);
    if (pin === null) return;

    if (pin.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong PIN. Main supply override not enabled.");
      return;
    }

    setUseMainSupplyOnce(true);
    setStatus(`✅ Next transaction will pull from: ${mainSupplyLocation.name} (one time only)`);
  }

  async function submit() {
    try {
      setStatus("");

      if (!locationId) return setStatus("ERROR: Choose a location first.");
      if (!code.trim()) return setStatus("ERROR: Scan or type an item/barcode first.");
      if (!Number.isFinite(qty) || qty <= 0) return setStatus("ERROR: Qty must be 1+.");

      // ✅ Decide which source location this transaction uses
      const sourceLocationId =
        useMainSupplyOnce && mainSupplyLocation ? mainSupplyLocation.id : locationId;

      // We also send the locked location so your backend can log "used in OR1"
      const lockedForDisplay = lockedLocationId || locationId;

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          location_id: sourceLocationId, // where it subtracts/adds
          used_in_location_id: lockedForDisplay, // optional: where it was used (audit)
          mode: mode === "USE" ? "OUT" : "IN",
          code: code.trim(),
          qty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        return setStatus(`ERROR: ${data?.error ?? `Request failed (${res.status})`}`);
      }

      setStatus(
        `✅ Saved. ${mode} ${qty} from ${
          sourceLocationId === locationId ? (selectedLocation?.name ?? "Location") : mainSupplyLocation?.name
        }`
      );

      // ✅ CRITICAL SAFETY: always auto-reset back to cabinet after submit
      setUseMainSupplyOnce(false);

      setCode("");
      setQty(1);
    } catch (e: any) {
      console.error(e);
      setStatus(`ERROR: ${e?.message ?? "Unknown error"}`);
      // also reset one-time override on failure (prevents “stuck”)
      setUseMainSupplyOnce(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ padding: 10, borderRadius: 12, border: "2px solid #000", marginBottom: 12, fontWeight: 900 }}>
        {VERSION}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>ASC Inventory</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => (isLocked ? unlockNow() : lockNow())} style={{ padding: "10px 14px", fontWeight: 900 }}>
            {isLocked ? "Unlock" : "Lock"}
          </button>
          <button onClick={changePin} style={{ padding: "10px 14px", fontWeight: 900 }}>
            PIN
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {isLocked ? (
          <div>
            🔒 Locked to: <b>{lockedLocation?.name ?? lockedLocationId}</b>
          </div>
        ) : (
          <div>
            🔓 Unlocked (default PIN <b>1234</b> until changed)
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 900 }}>Location</label>
        <select
          value={locationId}
          onChange={(e) => requestLocationChange(e.target.value)}
          disabled={loadingLocations}
          style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, fontSize: 16 }}
        >
          <option value="">{loadingLocations ? "Loading..." : "-- Select --"}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 6, color: "#666" }}>
          Selected: <b>{selectedLocation?.name ?? "—"}</b>
        </div>
      </div>

      {/* ✅ One-time Main Supply Override */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={requestMainSupplyOnce}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            fontWeight: 900,
          }}
        >
          Pull from Main Supply (ONE TIME)
        </button>

        <div style={{ marginTop: 6, color: useMainSupplyOnce ? "#0a7a2a" : "#666", fontWeight: 800 }}>
          Source for next submit:{" "}
          {useMainSupplyOnce && mainSupplyLocation ? (
            <span>{mainSupplyLocation.name} (one time)</span>
          ) : (
            <span>{selectedLocation?.name ?? "—"}</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 900 }}>Mode</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => setMode("USE")} style={{ flex: 1, padding: 12, fontWeight: 900 }}>
            USE
          </button>
          <button onClick={() => setMode("RESTOCK")} style={{ flex: 1, padding: 12, fontWeight: 900 }}>
            RESTOCK
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 900 }}>Item / Barcode</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: "100%", marginTop: 8, padding: 12 }} />
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 900 }}>Qty</label>
        <input value={String(qty)} onChange={(e) => setQty(Number(e.target.value))} style={{ width: "100%", marginTop: 8, padding: 12 }} />
      </div>

      <div style={{ marginTop: 18 }}>
        <button onClick={submit} style={{ width: "100%", padding: 14, fontWeight: 900 }}>
          Submit {mode}
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #ddd", fontWeight: 800 }}>
          {status}
        </div>
      )}
    </div>
  );
}

