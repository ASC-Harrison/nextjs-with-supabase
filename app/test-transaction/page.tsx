"use client";

import { useState } from "react";

export default function TestTransactionPage() {
  const [itemId, setItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [qty, setQty] = useState(1);
  const [txnType, setTxnType] = useState<"PULL" | "RESTOCK">("PULL");
  const [source, setSource] = useState<"CABINET" | "MAIN_SUPPLY">("CABINET");
  const [note, setNote] = useState("test");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    setStatus("Sending…");

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId.trim(),
          location_id: locationId.trim(),
          qty,
          txn_type: txnType,
          source,
          note: note || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(`❌ Error: ${data?.error ?? "Unknown error"}`);
      } else {
        setStatus("✅ Success! Check Supabase: inventory updated + transaction row created.");
      }
    } catch (e: any) {
      setStatus(`❌ Network/Server error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Test Transaction</h1>
      <p style={{ opacity: 0.8 }}>
        This page lets you test your API route without DevTools. Paste real UUIDs from Supabase.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Item ID (uuid)
          <input
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="e.g. 1b2c3d4e-...."
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Location ID (uuid)
          <input
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="e.g. 9a8b7c6d-...."
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Quantity
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Transaction Type
          <select
            value={txnType}
            onChange={(e) => setTxnType(e.target.value as any)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="PULL">PULL</option>
            <option value="RESTOCK">RESTOCK</option>
          </select>
        </label>

        <label>
          Source
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="CABINET">CABINET</option>
            <option value="MAIN_SUPPLY">MAIN_SUPPLY</option>
          </select>
        </label>

        <label>
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button
          onClick={runTest}
          disabled={loading || !itemId || !locationId}
          style={{
            padding: "12px 14px",
            fontWeight: 700,
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Running…" : "Run Test"}
        </button>

        {status && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
