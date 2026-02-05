"use client";

import React, { useMemo, useState } from "react";

type Direction = "OUT" | "IN";

export default function HomePage() {
  // 🔴 IMPORTANT: Replace these UUIDs with your real location IDs from Supabase
  const LOCATIONS = useMemo(
    () => [
      { id: "PASTE_OR_CORE_LOCATION_UUID_HERE", name: "OR Core" },
      { id: "PASTE_SPD_LOCATION_UUID_HERE", name: "SPD" },
      // add more if you want
    ],
    []
  );

  const [location_id, setLocationId] = useState(LOCATIONS[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("OUT");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState<number>(1);

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function callJson(url: string, payload?: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  }

  async function onSubmitScan() {
    setBusy(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const payload = {
        barcode: barcode.trim(),
        location_id,
        qty,
        direction, // "OUT" or "IN"
      };

      const { ok, status, data } = await callJson("/api/submit-scan", payload);

      if (!ok) {
        setErrorMsg(data?.error ? `${data.error} (status ${status})` : `Scan failed (status ${status})`);
        return;
      }

      setStatusMsg(
        `Scan OK: ${data?.item?.name ?? "Item"} | On hand: ${data?.on_hand_before} → ${data?.on_hand_after}`
      );
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
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
        setErrorMsg(data?.error ? `${data.error} (status ${status})` : `Email test failed (status ${status})`);
        return;
      }

      setStatusMsg("Test email sent ✅ Check inbox/spam.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>ASC Inventory Live</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Scan IN / OUT updates on-hand. LOW clears when restocked.
        </p>

        <label style={{ display: "block", marginTop: 18, fontWeight: 600 }}>Location</label>
        <select
          value={location_id}
          onChange={(e) => setLocationId(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
        >
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <label style={{ display: "block", marginTop: 18, fontWeight: 600 }}>Scan Type</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setDirection("OUT")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: direction === "OUT" ? "#111" : "#fff",
              color: direction === "OUT" ? "#fff" : "#111",
              fontWeight: 700,
            }}
            disabled={busy}
          >
            OUT (use)
          </button>
          <button
            type="button"
            onClick={() => setDirection("IN")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: direction === "IN" ? "#111" : "#fff",
              color: direction === "IN" ? "#fff" : "#111",
              fontWeight: 700,
            }}
            disabled={busy}
          >
            IN (restock)
          </button>
        </div>

        <label style={{ display: "block", marginTop: 18, fontWeight: 600 }}>Barcode</label>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or type barcode"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
          disabled={busy}
        />

        <label style={{ display: "block", marginTop: 18, fontWeight: 600 }}>Qty</label>
        <input
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          type="number"
          min={1}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
          disabled={busy}
        />

        <button
          type="button"
          onClick={onSubmitScan}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            border: "1px solid #ddd",
            marginTop: 18,
            fontSize: 18,
            fontWeight: 800,
          }}
          disabled={busy}
        >
          {busy ? "Working..." : "Submit Scan"}
        </button>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={onSendTestEmail}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 16,
              fontWeight: 700,
              background: "#fff",
            }}
            disabled={busy}
          >
            Send Test Email
          </button>
        </div>

        {errorMsg ? (
          <p style={{ color: "#c00", marginTop: 14, fontWeight: 700 }}>{errorMsg}</p>
        ) : null}

        {statusMsg ? (
          <p style={{ color: "#0a7", marginTop: 14, fontWeight: 700 }}>{statusMsg}</p>
        ) : null}
      </div>
    </main>
  );
}
