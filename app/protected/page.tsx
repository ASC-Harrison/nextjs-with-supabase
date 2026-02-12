"use client";

import { useEffect, useState } from "react";

type TotalRow = {
  item_id: string;
  item_name: string;
  barcode: string | null;
  total_on_hand: number;
};

export default function ProtectedPage() {
  const [location, setLocation] = useState("Main Sterile Supply");
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [itemOrBarcode, setItemOrBarcode] = useState("");
  const [qty, setQty] = useState(1);

  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState("");

  const [submitStatus, setSubmitStatus] = useState("Ready");
  const [rows, setRows] = useState<TotalRow[]>([]);
  const [listStatus, setListStatus] = useState("Loading inventory...");

  // Load unlock state
  useEffect(() => {
    const until = Number(localStorage.getItem("unlockedUntil") || "0");
    setIsUnlocked(Date.now() < until);
  }, []);

  // Load totals
  useEffect(() => {
    loadTotals();
  }, []);

  async function loadTotals() {
    setListStatus("Loading inventory...");
    const res = await fetch("/api/items");
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setRows([]);
      setListStatus("Failed to load inventory");
      return;
    }

    setRows(data.rows || []);
    setListStatus("");
  }

  async function handleUnlock() {
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setUnlockStatus("Invalid PIN");
      return;
    }

    const until = Date.now() + 30 * 60 * 1000;
    localStorage.setItem("unlockedUntil", String(until));
    setIsUnlocked(true);
    setPin("");
    setUnlockStatus("Unlocked");
  }

  function handleLock() {
    localStorage.removeItem("unlockedUntil");
    setIsUnlocked(false);
    setUnlockStatus("Locked");
  }

  async function handleSubmit() {
    setSubmitStatus("Submitting...");

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location,
        mode,
        itemOrBarcode,
        qty,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setSubmitStatus("Transaction failed");
      return;
    }

    setSubmitStatus("Success");
    setItemOrBarcode("");
    setQty(1);
    await loadTotals();
  }

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 20 }}>
      <h2>Inventory</h2>

      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 15 }}>
        <strong>{isUnlocked ? "Unlocked" : "Locked"}</strong>
        <div style={{ marginTop: 10 }}>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            style={{ padding: 8, marginRight: 8 }}
          />
          <button onClick={handleUnlock}>Unlock</button>
          <button onClick={handleLock} style={{ marginLeft: 8 }}>
            Lock
          </button>
        </div>
        <div>{unlockStatus}</div>
      </div>

      <div>
        <label>Location</label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={!isUnlocked}
          style={{ width: "100%", padding: 8 }}
        >
          <option>Main Sterile Supply</option>
          <option>OR 1 - Cabinet A</option>
          <option>OR 2 - Cabinet A</option>
          <option>Pre-Op</option>
          <option>PACU</option>
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={() => setMode("USE")}>USE</button>
        <button onClick={() => setMode("RESTOCK")} style={{ marginLeft: 8 }}>
          RESTOCK
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          value={itemOrBarcode}
          onChange={(e) => setItemOrBarcode(e.target.value)}
          placeholder="Item name or barcode"
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <button
        onClick={handleSubmit}
        style={{ marginTop: 15, width: "100%", padding: 10 }}
      >
        Submit {mode}
      </button>

      <div style={{ marginTop: 15 }}>{submitStatus}</div>

      <div style={{ marginTop: 30 }}>
        <h3>Total Inventory</h3>

        {listStatus && <div>{listStatus}</div>}

        {rows.map((r) => (
          <div
            key={r.item_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1px solid #eee",
              padding: "6px 0",
            }}
          >
            <div>
              <strong>{r.item_name}</strong>
              <div style={{ fontSize: 12 }}>{r.barcode}</div>
            </div>
            <div>{r.total_on_hand}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
