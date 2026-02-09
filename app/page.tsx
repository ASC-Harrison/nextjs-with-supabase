"use client";

import React, { useEffect, useMemo, useState } from "react";

type Location = { id: string; name: string };

const LS_LOCKED = "asc_lock_isLocked";
const LS_LOCKED_LOC = "asc_lock_locationId";
const LS_MASTER_PIN = "asc_lock_masterPin";

function getMasterPin(): string {
  // default pin the very first time
  const existing =
    typeof window !== "undefined" ? window.localStorage.getItem(LS_MASTER_PIN) : null;
  return existing && existing.trim().length > 0 ? existing : "1234";
}

function setMasterPin(pin: string) {
  window.localStorage.setItem(LS_MASTER_PIN, pin);
}

export default function Page() {
  // --- SAMPLE locations (replace with your real fetch if you already have one) ---
  // If you already fetch locations elsewhere in this file, KEEP that code
  // and delete this sample list.
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);

  // --- Your existing main inputs (keep/adjust as needed) ---
  const [locationId, setLocationId] = useState<string>("");
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [query, setQuery] = useState<string>(""); // barcode or search text
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<string>("");

  // --- Lock state ---
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedLocationId, setLockedLocationId] = useState<string>("");

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  );

  const lockedLocation = useMemo(
    () => locations.find((l) => l.id === lockedLocationId),
    [locations, lockedLocationId]
  );

  // Load locations from your API (recommended)
  useEffect(() => {
    (async () => {
      try {
        setLoadingLocations(true);

        // ✅ If you already have /api/storage-areas working, this will use it.
        // If your route name is different, change it here.
        const res = await fetch("/api/storage-areas", { method: "GET" });
        if (!res.ok) throw new Error(`Locations fetch failed: ${res.status}`);

        const data = await res.json();

        // Expecting: { ok: true, locations: [{id,name}, ...] } OR just an array
        const locs: Location[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : Array.isArray(data?.data)
          ? data.data
          : [];

        setLocations(locs);
      } catch (e: any) {
        // Fallback: leave empty, but don’t crash the app
        console.error(e);
        setLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    })();
  }, []);

  // Restore lock from localStorage on first load
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLocked = window.localStorage.getItem(LS_LOCKED) === "true";
    const savedLoc = window.localStorage.getItem(LS_LOCKED_LOC) || "";

    if (savedLocked && savedLoc) {
      setIsLocked(true);
      setLockedLocationId(savedLoc);
      setLocationId(savedLoc); // force location to locked one
    }
  }, []);

  // If locked, force selected location to the locked location
  useEffect(() => {
    if (!isLocked) return;
    if (!lockedLocationId) return;

    if (locationId !== lockedLocationId) {
      setLocationId(lockedLocationId);
    }
  }, [isLocked, lockedLocationId, locationId]);

  function lockToCurrentLocation() {
    if (!locationId) {
      setStatus("ERROR: Pick a location first, then press Lock.");
      return;
    }

    setIsLocked(true);
    setLockedLocationId(locationId);

    window.localStorage.setItem(LS_LOCKED, "true");
    window.localStorage.setItem(LS_LOCKED_LOC, locationId);

    setStatus(`Locked to location: ${selectedLocation?.name ?? locationId}`);
  }

  function unlockWithPin() {
    const pin = window.prompt("Enter master PIN to unlock location:");
    if (pin === null) return; // cancelled

    const master = getMasterPin();
    if (pin.trim() !== master) {
      setStatus("ERROR: Wrong PIN. Location is still locked.");
      return;
    }

    setIsLocked(false);
    setLockedLocationId("");
    window.localStorage.setItem(LS_LOCKED, "false");
    window.localStorage.removeItem(LS_LOCKED_LOC);

    setStatus("Unlocked. You can change locations now.");
  }

  function changeMasterPin() {
    const current = window.prompt("Enter CURRENT master PIN:");
    if (current === null) return;

    if (current.trim() !== getMasterPin()) {
      setStatus("ERROR: Current PIN is wrong. PIN was not changed.");
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

  async function submit() {
    try {
      setStatus("");

      if (!locationId) {
        setStatus("ERROR: Choose a location first.");
        return;
      }
      if (!query.trim()) {
        setStatus("ERROR: Scan or type an item/barcode first.");
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        setStatus("ERROR: Qty must be 1 or more.");
        return;
      }

      // ✅ Change this endpoint to your real “scan/use/restock” route if needed.
      // If you already have one, set it here and keep the payload shape you expect.
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: locationId,
          mode: mode === "USE" ? "OUT" : "IN",
          code: query.trim(),
          qty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setStatus(`ERROR: ${data?.error ?? `Request failed (${res.status})`}`);
        return;
      }

      setStatus("✅ Saved.");
      setQuery("");
      setQty(1);
    } catch (e: any) {
      console.error(e);
      setStatus(`ERROR: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>ASC Inventory</h1>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => (isLocked ? unlockWithPin() : lockToCurrentLocation())}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: isLocked ? "#111" : "#fff",
              color: isLocked ? "#fff" : "#111",
              fontWeight: 700,
            }}
          >
            {isLocked ? "Unlock" : "Lock"}
          </button>

          <button
            onClick={changeMasterPin}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
            }}
          >
            PIN
          </button>
        </div>
      </div>

      <p style={{ marginTop: 6, color: "#555" }}>
        {isLocked ? (
          <>
            🔒 Locked to: <b>{lockedLocation?.name ?? lockedLocationId}</b>
          </>
        ) : (
          <>
            🔓 Not locked (default PIN is <b>1234</b> until you change it)
          </>
        )}
      </p>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 700 }}>Location</label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={isLocked || loadingLocations}
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            background: isLocked ? "#f3f3f3" : "#fff",
            fontSize: 16,
          }}
        >
          <option value="">{loadingLocations ? "Loading..." : "-- Select a location --"}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {locationId && (
          <div style={{ marginTop: 6, color: "#666" }}>
            Selected: <b>{selectedLocation?.name ?? locationId}</b>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 700 }}>Mode</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={() => setMode("USE")}
            disabled={isLocked} // lock also freezes mode (recommended)
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ccc",
              background: mode === "USE" ? "#111" : "#fff",
              color: mode === "USE" ? "#fff" : "#111",
              fontWeight: 800,
            }}
          >
            USE (subtract)
          </button>
          <button
            onClick={() => setMode("RESTOCK")}
            disabled={isLocked}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ccc",
              background: mode === "RESTOCK" ? "#111" : "#fff",
              color: mode === "RESTOCK" ? "#fff" : "#111",
              fontWeight: 800,
            }}
          >
            RESTOCK
          </button>
        </div>
        {isLocked && (
          <div style={{ marginTop: 6, color: "#666" }}>
            Mode is also locked (prevents accidental RESTOCK/USE flips).
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 700 }}>Item / Barcode</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
        <label style={{ fontWeight: 700 }}>Qty</label>
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
          }}
        >
          Submit {mode === "USE" ? "USE" : "RESTOCK"}
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
            fontWeight: 700,
            whiteSpace: "pre-wrap",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
