"use client";

import React, { useEffect, useMemo, useState } from "react";

type Location = { id: string; name: string; active?: boolean };

const VERSION = "LOCK-PIN v5 + CANCEL OVERRIDE (works)";

// localStorage keys
const LS_LOCKED = "asc_lock_isLocked";
const LS_LOCKED_LOC = "asc_lock_locationId";
const LS_MASTER_PIN = "asc_lock_masterPin";

// ✅ must match EXACTLY what you saw in Supabase
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

  // Lock state
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedLocationId, setLockedLocationId] = useState<string>("");

  // ✅ ONE-TIME OVERRIDE FLAG (this is what the cancel button controls)
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

  // Restore lock state
  useEffect(() => {
    const savedLocked = lsGet(LS_LOCKED) === "true";
    const savedLoc = lsGet(LS_LOCKED_LOC) || "";

    if (savedLocked && savedLoc) {
      setIsLocked(true);
      setLockedLocationId(savedLoc);
      setLocationId(savedLoc);
    }
  }, []);

  function lockNow() {
    if (!locationId) return setStatus("ERROR: Pick a location first.");
    setIsLocked(true);
    setLockedLocationId(locationId);
    lsSet(LS_LOCKED, "true");
    lsSet(LS_LOCKED_LOC, locationId);
    setStatus(`Locked to: ${selectedLocation?.name ?? locationId}`);
  }

  function unlockNow() {
    const pin = window.prompt("Enter master PIN to unlock:");
    if (pin === null) return;
    if (pin.trim() !== getMasterPin()) return setStatus("ERROR: Wrong PIN. Still locked.");

    setIsLocked(false);
    setLockedLocationId("");
    lsSet(LS_LOCKED, "false");
    lsRemove(LS_LOCKED_LOC);
    setStatus("Unlocked.");
  }

  function changePin() {
    const current = window.prompt("Enter CURRENT master PIN:");
    if (current === null) return;
    if (current.trim() !== getMasterPin()) return setStatus("ERROR: Wrong current PIN.");

    const next = window.prompt("Enter NEW master PIN (4+ digits):");
    if (next === null) return;
    const cleaned = next.trim();
    if (cleaned.length < 4) return setStatus("ERROR: PIN too short.");

    lsSet(LS_MASTER_PIN, cleaned);
    setStatus("Master PIN updated.");
  }

  // Location change guard (PIN required if locked)
  function requestLocationChange(nextId: string) {
    if (!isLocked) {
      setLocationId(nextId);
      setUseMainSupplyOnce(false); // safety: clear override on change
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

    setLocationId(nextId);
    setLockedLocationId(nextId);
    lsSet(LS_LOCKED, "true");
    lsSet(LS_LOCKED_LOC, nextId);

    setUseMainSupplyOnce(false); // safety: clear override on change
    setStatus("Location changed (PIN accepted) and still locked.");
  }

  // ✅ Turn ON override (requires PIN)
  function armMainSupplyOnce() {
    if (!mainSupplyLocation) {
      setStatus(`ERROR: Could not find "${MAIN_SUPPLY_NAME}" in locations.`);
      return;
    }
    const pin = window.prompt(`Enter PIN to pull from "${mainSupplyLocation.name}" (ONE TIME):`);
    if (pin === null) return;
    if (pin.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong PIN. Override not enabled.");
      return;
    }

    setUseMainSupplyOnce(true);
    setStatus(`✅ Next submit will pull from ${mainSupplyLocation.name} (one time).`);
  }

  // ✅ Cancel button (NO PIN)
  function cancelOverride() {
    setUseMainSupplyOnce(false);
    setStatus("Override canceled. Next submit will use the cabinet.");
  }

  async function submit() {
    try {
      setStatus("");

      if (!locationId) return setStatus("ERROR: Choose a location first.");
      if (!code.trim()) return setStatus("ERROR: Scan or type an item/barcode first.");
      if (!Number.isFinite(qty) || qty <= 0) return setStatus("ERROR: Qty must be 1+.");

      // decide source
      const sourceLocationId =
        useMainSupplyOnce && mainSupplyLocation ? mainSupplyLocation.id : locationId;

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          location_id: sourceLocationId,
          mode: mode === "USE" ? "OUT" : "IN",
          code: code.trim(),
          qty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        // safety: don’t leave override on if something errors
        setUseMainSupplyOnce(false);
        return setStatus(`ERROR: ${data?.error ?? `Request failed (${res.status})`}`);
      }

      // ✅ ALWAYS reset override after any submit
      setUseMainSupplyOnce(false);

      setStatus(
        `✅ Saved. ${mode} ${qty} from ${
          sourceLocationId === locationId
            ? (selectedLocation?.name ?? "Cabinet")
            : (mainSupplyLocation?.name ?? "Main Supply")
        }.`
      );

      setCode("");
      setQty(1);
    } catch (e: any) {
      console.error(e);
      setUseMainSupplyOnce(false); // safety reset
      setStatus(`ERROR: ${e?.message ?? "Unknown error"}`);
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
          <div>🔒 Locked to: <b>{lockedLocation?.name ?? lockedLocationId}</b></div>
        ) : (
          <div>🔓 Unlocked (default PIN <b>1234</b> until changed)</div>
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
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <div style={{ marginTop: 6, color: "#666" }}>
          Selected: <b>{selectedLocation?.name ?? "—"}</b>
        </div>
      </div>

      {/* ✅ Main supply one-time override + cancel */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={armMainSupplyOnce}
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

        {useMainSupplyOnce ? (
          <>
            <div style={{ marginTop: 8, padding: 10, borderRadius: 12, border: "2px solid #19a34a", color: "#0a7a2a", fontWeight: 900 }}>
              Source for next submit: {mainSupplyLocation?.name ?? MAIN_SUPPLY_NAME} (one time)
            </div>

            <button
              type="button"
              onClick={cancelOverride}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ccc",
                fontWeight: 900,
                background: "#f3f3f3",
              }}
            >
              Cancel Main Supply Override
            </button>
          </>
        ) : (
          <div style={{ marginTop: 8, color: "#666", fontWeight: 800 }}>
            Source for next submit: {selectedLocation?.name ?? "—"}
          </div>
        )}
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
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan or type"
          style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 900 }}>Qty</label>
        <input
          value={String(qty)}
          onChange={(e) => setQty(Number(e.target.value))}
          inputMode="numeric"
          style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <button onClick={submit} style={{ width: "100%", padding: 14, fontWeight: 900 }}>
          Submit {mode}
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #ddd", fontWeight: 900 }}>
          {status}
        </div>
      )}
    </div>
  );
}
