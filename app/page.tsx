"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Direction = "OUT" | "IN";

type LocationRow = {
  id: string;
  name: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default function HomePage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [location_id, setLocationId] = useState("");
  const [direction, setDirection] = useState<Direction>("OUT");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState<number>(1);

  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ Load locations from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");

      if (error) {
        setErrorMsg("Could not load locations: " + error.message);
        return;
      }

      const rows = (data ?? []) as LocationRow[];
      setLocations(rows);

      // default selection
      if (rows.length > 0) setLocationId(rows[0].id);
    })();
  }, []);

  async function callJson(url: string, payload?: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function onSubmitScan() {
    setBusy(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const payload = {
        barcode: barcode.trim(),
        location_id, // ✅ UUID from locations table
        qty,
        direction,
      };

      const { ok, status, data } = await callJson("/api/submit-scan", payload);

      if (!ok) {
        setErrorMsg((data?.error ?? "Scan failed") + ` (status ${status})`);
        return;
      }

      setStatusMsg(`Scan OK. On hand: ${data.before} → ${data.after}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSendTestEmail() {
    setBusy(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const { ok, status, data } = await callJson("/api/test-email");

      if (!ok) {
        setErrorMsg((data?.error ?? "Email test failed") + ` (status ${status})`);
        return;
      }

      setStatusMsg("Test email sent ✅");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1>ASC Inventory Live</h1>
      <p>Scan IN / OUT updates on-hand. LOW clears when restocked.</p>

      <label style={{ fontWeight: 700 }}>Location</label>
      <select
        value={location_id}
        onChange={(e) => setLocationId(e.target.value)}
        style={{ width: "100%", padding: 12, marginTop: 8 }}
        disabled={busy || locations.length === 0}
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={() => setDirection("OUT")} disabled={busy} style={{ flex: 1 }}>
          OUT (use)
        </button>
        <button onClick={() => setDirection("IN")} disabled={busy} style={{ flex: 1 }}>
          IN (restock)
        </button>
      </div>

      <label style={{ fontWeight: 700, display: "block", marginTop: 14 }}>Barcode</label>
      <input value={barcode} onChange={(e) => setBarcode(e.target.value)} style={{ width: "100%", padding: 12 }} />

      <label style={{ fontWeight: 700, display: "block", marginTop: 14 }}>Qty</label>
      <input
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        type="number"
        min={1}
        style={{ width: "100%", padding: 12 }}
      />

      <button onClick={onSubmitScan} disabled={busy} style={{ width: "100%", marginTop: 18, padding: 14 }}>
        Submit Scan
      </button>

      <button onClick={onSendTestEmail} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 14 }}>
        Send Test Email
      </button>

      {errorMsg ? <p style={{ color: "red", fontWeight: 700 }}>{errorMsg}</p> : null}
      {statusMsg ? <p style={{ color: "green", fontWeight: 700 }}>{statusMsg}</p> : null}
    </main>
  );
}
