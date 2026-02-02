"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = { id: string; name: string };
type ItemRow = { item_id: string; name: string; barcode: string };
type ScanType = "IN" | "OUT";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export default function ProtectedInventoryPage() {
  // --- State ---
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [barcode, setBarcode] = useState<string>("");

  // IMPORTANT: qty is a string (input value). Convert only at submit.
  const [qty, setQty] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  // HARD SUBMIT LOCK (prevents double submit on iPhone / lag taps)
  const submitLockRef = useRef(false);

  // --- Load locations ---
  useEffect(() => {
    (async () => {
      setErr("");
      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name", { ascending: true });

      if (error) {
        setErr(`Failed to load locations: ${error.message}`);
        return;
      }

      const rows = (data ?? []) as LocationRow[];
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr("");
    setMsg("");

    // HARD LOCK first (stops duplicates even if state lags)
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setBusy(true);
    try {
      const cleanedBarcode = barcode.trim();
      if (!cleanedBarcode) {
        setErr("Barcode is required.");
        return;
      }
      if (!locationId) {
        setErr("Location is required.");
        return;
      }

      // Convert qty ONLY here (never default to 10)
      const qtyNum = Number(qty);
      if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
        setErr("Qty must be a whole number greater than 0.");
        return;
      }

      // Find item by barcode
      const { data: item, error: itemErr } = await supabase
        .from("items")
        .select("item_id,name,barcode")
        .eq("barcode", cleanedBarcode)
        .single();

      if (itemErr || !item) {
        setErr(itemErr?.message ?? "Item not found for that barcode.");
        return;
      }

      const itemRow = item as ItemRow;

      // INSERT ONE transaction row ONLY (do not update inventory from the app)
      const { error: txErr } = await supabase.from("transactions").insert([
        {
          type: scanType,
          qty: qtyNum, // EXACT qty you entered (5 means 5)
          item_id: itemRow.item_id,
          location_id: locationId,
        },
      ]);

      if (txErr) {
        setErr(txErr.message);
        return;
      }

      setMsg(`${scanType} saved: ${itemRow.name} (${qtyNum}).`);
      setBarcode("");
      // keep qty if you want speed, or clear it:
      // setQty("");
    } finally {
      setBusy(false);
      submitLockRef.current = false; // release lock
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "28px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
        ASC Inventory Live
      </h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Scan IN/OUT updates on-hand instantly.
      </p>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
        }}
      >
        {/* Location */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>
            Location
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scan Type */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>
            Scan Type
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setScanType("OUT")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: scanType === "OUT" ? "#111" : "#fff",
                color: scanType === "OUT" ? "#fff" : "#111",
                fontWeight: 900,
              }}
            >
              OUT (use)
            </button>
            <button
              type="button"
              onClick={() => setScanType("IN")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: scanType === "IN" ? "#111" : "#fff",
                color: scanType === "IN" ? "#fff" : "#111",
                fontWeight: 900,
              }}
            >
              IN (restock)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Barcode */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>
              Barcode
            </label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {/* Qty */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>
              Qty
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 5"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Submitting…" : "Submit Scan"}
          </button>
        </form>

        {err && (
          <div
            style={{
              marginTop: 14,
              background: "#ffe8e8",
              border: "1px solid #ffb4b4",
              padding: 12,
              borderRadius: 12,
            }}
          >
            <strong>Error:</strong> {err}
          </div>
        )}

        {msg && (
          <div
            style={{
              marginTop: 14,
              background: "#e8fff0",
              border: "1px solid #9ae6b4",
              padding: 12,
              borderRadius: 12,
            }}
          >
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
