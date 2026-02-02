"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = { name: string };
type ScanType = "OUT" | "IN";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationName, setLocationName] = useState<string>("OR Core");
  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [barcode, setBarcode] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Prevent accidental double-submit (mobile tap + click / form submit etc.)
  const submitLockRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("name")
        .order("name");
      if (error) setErr(error.message);
      else setLocations(data ?? []);
    })();
  }, []);

  const qtyInt = useMemo(() => {
    const n = Number.parseInt(qty, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [qty]);

  async function submitScan(e?: React.FormEvent) {
    e?.preventDefault();
    setErr("");
    setMsg("");

    if (busy || submitLockRef.current) return;
    submitLockRef.current = true;
    setBusy(true);

    try {
      if (!barcode.trim()) {
        setErr("Barcode is required.");
        return;
      }

      const { data, error } = await supabase.rpc("apply_scan", {
        p_barcode: barcode.trim(),
        p_location_name: locationName,
        p_type: scanType,
        p_qty: qtyInt,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;
      setMsg(
        row
          ? `Updated: on_hand=${row.on_hand} status=${row.status}`
          : "Scan submitted."
      );

      setBarcode("");
      setQty("1");
    } finally {
      setBusy(false);
      // small delay helps prevent double tap on iPhone
      setTimeout(() => {
        submitLockRef.current = false;
      }, 300);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>ASC Inventory Live</h1>
      <p style={{ opacity: 0.75 }}>
        Scan IN/OUT updates on-hand instantly. LOW flags clear when restocked.
      </p>

      <form onSubmit={submitScan} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Location
        </label>
        <select
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, marginBottom: 14 }}
        >
          {locations.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setScanType("OUT")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: scanType === "OUT" ? "#111" : "#fff",
              color: scanType === "OUT" ? "#fff" : "#111",
              fontWeight: 800,
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
              border: "1px solid #ddd",
              background: scanType === "IN" ? "#111" : "#fff",
              color: scanType === "IN" ? "#fff" : "#111",
              fontWeight: 800,
            }}
          >
            IN (restock)
          </button>
        </div>

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Barcode
        </label>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Type or scan barcode..."
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginBottom: 14 }}
        />

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Qty
        </label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginBottom: 14 }}
        />

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
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Submitting..." : "Submit Scan"}
        </button>

        {err ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#ffe5e5", color: "#7a0000" }}>
            <b>Error:</b> {err}
          </div>
        ) : null}

        {msg ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#e9f5ff" }}>
            {msg}
          </div>
        ) : null}
      </form>

      <div style={{ marginTop: 14 }}>
        <a href="/low-stock" style={{ textDecoration: "underline" }}>
          View Low Stock
        </a>
      </div>
    </main>
  );
}
