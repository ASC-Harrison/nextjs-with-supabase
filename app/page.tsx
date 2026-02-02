"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ScanType = "IN" | "OUT";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const [locations, setLocations] = useState<string[]>([]);
  const [locationName, setLocationName] = useState<string>("OR Core");
  const [scanType, setScanType] = useState<ScanType>("OUT");

  const [barcode, setBarcode] = useState<string>("");
  const [qty, setQty] = useState<string>("1");

  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Always turn qty into a real integer (no 10s bug)
  const qtyInt = useMemo(() => {
    const n = Number.parseInt(String(qty), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [qty]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("name")
        .order("name", { ascending: true });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setLocations((data ?? []).map((r: any) => r.name));
    })();
  }, []);

  async function submitScan(e?: React.FormEvent) {
    e?.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    // iPhone double-tap protection
    if (busy || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);

    try {
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) {
        setErrorMsg("Barcode is required.");
        return;
      }
      if (!locationName) {
        setErrorMsg("Location is required.");
        return;
      }

      // IMPORTANT: these keys MUST match your function parameter names
      const { data, error } = await supabase.rpc("apply_scan", {
        p_barcode: cleanBarcode,
        p_location_name: locationName,
        p_qty: qtyInt,
        p_type: scanType,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      // Supabase RPC returns an array for table returns
      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setErrorMsg("No data returned from apply_scan().");
        return;
      }

      // Your function should return on_hand + status
      setStatusMsg(`Updated: on_hand=${row.on_hand} status=${row.status}`);

      // reset inputs
      setBarcode("");
      setQty("1");
    } finally {
      setBusy(false);
      setTimeout(() => {
        lockRef.current = false;
      }, 300);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>ASC Inventory Live</h1>
      <p style={{ opacity: 0.75 }}>
        Scan IN/OUT updates inventory immediately. Low-stock alerts fire when an
        item becomes LOW.
      </p>

      <form
        onSubmit={submitScan}
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          padding: 16,
          marginTop: 14,
        }}
      >
        <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
          Location
        </label>
        <select
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            marginBottom: 14,
          }}
        >
          {locations.length === 0 ? (
            <option value="OR Core">OR Core</option>
          ) : (
            locations.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          )}
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
              fontWeight: 900,
              background: scanType === "OUT" ? "#111" : "#fff",
              color: scanType === "OUT" ? "#fff" : "#111",
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
              fontWeight: 900,
              background: scanType === "IN" ? "#111" : "#fff",
              color: scanType === "IN" ? "#fff" : "#111",
            }}
          >
            IN (restock)
          </button>
        </div>

        <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
          Barcode
        </label>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Type or scan barcode..."
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            marginBottom: 14,
          }}
        />

        <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
          Qty
        </label>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            marginBottom: 14,
          }}
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

        {errorMsg ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: "#ffe7e7",
              color: "#7a0000",
            }}
          >
            <b>Error:</b> {errorMsg}
          </div>
        ) : null}

        {statusMsg ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: "#e9f5ff",
            }}
          >
            {statusMsg}
          </div>
        ) : null}
      </form>
    </main>
  );
}
