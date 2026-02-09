"use client";

import React, { useEffect, useMemo, useState } from "react";

type Location = { id: string; name: string; active?: boolean };

const LS_LOCKED = "asc_lock_isLocked";
const LS_LOCKED_LOC = "asc_lock_locationId";
const LS_MASTER_PIN = "asc_lock_masterPin";

function readLS(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}
function writeLS(key: string, value: string) {
  window.localStorage.setItem(key, value);
}
function removeLS(key: string) {
  window.localStorage.removeItem(key);
}

function getMasterPin(): string {
  const pin = readLS(LS_MASTER_PIN);
  return pin && pin.trim().length > 0 ? pin.trim() : "1234";
}
function setMasterPin(pin: string) {
  writeLS(LS_MASTER_PIN, pin);
}

export default function Page() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // Selected location + mode
  const [locationId, setLocationId] = useState<string>("");
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");

  // Inputs
  const [code, setCode] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  // UI status
  const [status, setStatus] = useState<string>("");

  // Lock state
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedLocationId, setLockedLocationId] = useState<string>("");

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId) || null,
    [locations, locationId]
  );

  const lockedLocation = useMemo(
    () => locations.find((l) => l.id === lockedLocationId) || null,
    [locations, lockedLocationId]
  );

  // 1) Load locations from your API
  useEffect(() => {
    (async () => {
      try {
        setLoadingLocations(true);

        // NOTE: Your API should return { ok:true, storage_areas:[{id,name},...] }
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const json = await res.json();

        const list: Location[] =
          json?.storage_areas ??
          json?.locations ??
          json?.data ??
          (Array.isArray(json) ? json : []);

        setLocations(list);

        // If nothing selected yet, pick first active or first item
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

  // 2) Restore lock state on load
  useEffect(() => {
    const savedLocked = readLS(LS_LOCKED) === "true";
    const savedLoc = readLS(LS_LOCKED_LOC) || "";

    if (savedLocked && savedLoc) {
      setIsLocked(true);
      setLockedLocationId(savedLoc);
      setLocationId(savedLoc); // force to locked
    }
  }, []);

  // 3) If locked, force selected location to the locked location (hard rule)
  useEffect(() => {
    if (!isLocked) return;
    if (!lockedLocationId) return;

    if (locationId !== lockedLocationId) {
      setLocationId(lockedLocationId);
    }
  }, [isLocked, lockedLocationId, locationId]);

  // ✅ 4) AUTO-LOCK BEHAVIOR (recommended ON)
  // As soon as a location is selected the first time, it locks the device to that location.
  // You can still unlock with PIN.
  useEffect(() => {
    if (!locationId) return;

    // If already locked (from saved state), do nothing
    if (isLocked) return;

    // Auto-lock to chosen location
    setIsLocked(true);
    setLockedLocationId(locationId);
    writeLS(LS_LOCKED, "true");
    writeLS(LS_LOCKED_LOC, locationId);

    setStatus(`Locked to location: ${selectedLocation?.name ?? locationId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  function lockToCurrentLocation() {
    if (!locationId) {
      setStatus("ERROR: Pick a location first, then press Lock.");
      return;
    }

    setIsLocked(true);
    setLockedLocationId(locationId);
    writeLS(LS_LOCKED, "true");
    writeLS(LS_LOCKED_LOC, locationId);

    setStatus(`Locked to location: ${selectedLocation?.name ?? locationId}`);
  }

  function unlockWithPin() {
    const pin = window.prompt("Enter master PIN to unlock location:");
    if (pin === null) return;

    const master = getMasterPin();
    if (pin.trim() !== master) {
      setStatus("ERROR: Wrong PIN. Still locked.");
      return;
    }

    setIsLocked(false);
    setLockedLocationId("");
    writeLS(LS_LOCKED, "false");
    removeLS(LS_LOCKED_LOC);

    setStatus("Unlocked. You can change locations now.");
  }

  function changePin() {
    const current = window.prompt("Enter CURRENT master PIN:");
    if (current === null) return;

    if (current.trim() !== getMasterPin()) {
      setStatus("ERROR: Current PIN is wrong. PIN not changed.");
      return;
    }

    const next = window.prompt("Enter NEW master PIN (4+ digits recommended):");
    if (next === null) return;

    const cleaned = next.trim();
    if (cleaned.length < 4) {
      setStatus("ERROR: PIN too short. Use at least 4 digits.");
      return;
    }

    setMasterPin(cleaned);
    setStatus("Master PIN updated.");
  }

  // HARD GUARD: If user tries to change location while locked, force PIN flow
  function requestLocationChange(nextId: string) {
    if (!nextId) return;

    // If not locked, allow
    if (!isLocked) {
      setLocationId(nextId);
      return;
    }

    // If locked but they picked the same one, allow silently
    if (nextId === lockedLocationId) return;

    // Locked and trying to change -> require PIN
    const pin = window.prompt("Location is locked. Enter master PIN to change location:");
    if (pin === null) return;

    if (pin.trim() !== getMasterPin()) {
      setStatus("ERROR: Wrong PIN. Location not changed.");
      return;
    }

    // Correct PIN -> unlock + change + re-lock to new location
    setIsLocked(false);
    setLockedLocationId("");
    writeLS(LS_LOCKED, "false");
    removeLS(LS_LOCKED_LOC);

    setLocationId(nextId);

    // Re-lock immediately to new location
    setIsLocked(true);
    setLockedLocationId(nextId);
    writeLS(LS_LOCKED, "true");
    writeLS(LS_LOCKED_LOC, nextId);

    setStatus("Location changed and locked.");
  }

  // Basic submit (keeps your existing flow)
  async function submit() {
    try {
      setStatus("");

      if (!locationId) {
        setStatus("ERROR: Choose a location first.");
        return;
      }
      if (!code.trim()) {
        setStatus("ERROR: Scan or type an item/barcode first.");
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        setStatus("ERROR: Qty must be 1 or more.");
        return;
      }

      // Adjust this to match YOUR API payload if needed
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          location_id: locationId,
          mode: mode === "USE" ? "OUT" : "IN",
          code: code.trim(),
          qty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setStatus(`ERROR: ${data?.error ?? `Request failed (${res.status})`}`);
        return;
      }

      setStatus("✅ Saved.");
      setCode("");
      setQty(1);
    } catch (e: any) {
      console.error(e);
      setStatus(`ERROR: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>ASC Inventory</h1>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => (isLocked ? unlockWithPin() : lockToCurrentLocation())}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: isLocked ? "#111" : "#fff",
              color: isLocked ? "#fff" : "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {isLocked ? "Unlock" : "Lock"}
          </button>

          <button
            type="button"
            onClick={changePin}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            PIN
          </button>
        </div>
      </div>

      <div style={{ marginTop: 6, color: "#555" }}>
        {isLocked ? (
          <>
            🔒 Locked to: <b>{lockedLocation?.name ?? lockedLocationId}</b>
          </>
        ) : (
          <>
            🔓 Unlocked (default PIN is <b>1234</b> until you change it)
          </>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 800 }}>Location</label>
        <select
          value={locationId}
          onChange={(e) => requestLocationChange(e.target.value)}
          disabled={loadingLocations}
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            fontSize: 16,
            background: loadingLocations ? "#f3f3f3" : "#fff",
          }}
        >
          <option value="">{loadingLocations ? "Loading..." : "-- Select a location --"}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {selectedLocation && (
          <div style={{ marginTop: 6, color: "#666" }}>
            Selected: <b>{selectedLocation.name}</b>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 800 }}>Mode</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setMode("USE")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ccc",
              background: mode === "USE" ? "#111" : "#fff",
              color: mode === "USE" ? "#fff" : "#111",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            USE (subtract)
          </button>
          <button
            type="button"
            onClick={() => setMode("RESTOCK")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ccc",
              background: mode === "RESTOCK" ? "#111" : "#fff",
              color: mode === "RESTOCK" ? "#fff" : "#111",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            RESTOCK
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 800 }}>Item / Barcode</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan or type"
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 800 }}>Qty</label>
        <input
          value={String(qty)}
          onChange={(e) => setQty(Number(e.target.value))}
          inputMode="numeric"
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={submit}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 14,
            border: "none",
            background: "#111",
            color: "#fff",
            fontWeight: 900,
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          Submit {mode}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: status.startsWith("ERROR") ? "#fff2f2" : "#f2fff4",
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
