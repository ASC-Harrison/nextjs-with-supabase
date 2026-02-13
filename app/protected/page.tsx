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

  // ---- Lock persistence ----
  useEffect(() => {
    const until = Number(localStorage.getItem("unlockedUntil") || "0");
    setIsUnlocked(Date.now() < until);
  }, []);

  function lockNow() {
    localStorage.removeItem("unlockedUntil");
    setIsUnlocked(false);
    setUnlockStatus("🔒 Locked");
  }

  // ---- Inventory totals loader ----
  async function loadTotals() {
    try {
      setListStatus("Loading inventory...");
      const res = await fetch("/api/items", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setRows([]);
        setListStatus(`❌ ${data?.error ?? `Failed (${res.status})`}`);
        return;
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setListStatus("");
    } catch (e: any) {
      setRows([]);
      setListStatus(`❌ ${e?.message ?? "Failed to load inventory"}`);
    }
  }

  useEffect(() => {
    loadTotals();
  }, []);

  // ---- Unlock ----
  async function handleUnlock() {
    try {
      setUnlockStatus("Unlocking...");
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setUnlockStatus(`❌ ${data?.error ?? "Invalid PIN"}`);
        return;
      }

      const until = Date.now() + 30 * 60 * 1000;
      localStorage.setItem("unlockedUntil", String(until));
      setIsUnlocked(true);
      setPin("");
      setUnlockStatus("✅ Unlocked (30 min)");
    } catch (e: any) {
      setUnlockStatus(`❌ ${e?.message ?? "Unlock failed"}`);
    }
  }

  // ---- Submit transaction ----
  async function handleSubmit() {
    if (!location.trim()) {
      setSubmitStatus("❌ Select a location");
      return;
    }
    if (!itemOrBarcode.trim()) {
      setSubmitStatus("❌ Enter an item name or barcode");
      return;
    }
    const safeQty = Math.max(1, Number(qty) || 1);

    try {
      setSubmitStatus("Submitting...");

      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          mode,
          itemOrBarcode: itemOrBarcode.trim(),
          qty: safeQty,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setSubmitStatus(`❌ ${data?.error ?? `Failed (${res.status})`}`);
        return;
      }

      const name = data?.item?.name ?? itemOrBarcode.trim();
      const locName = data?.location?.name ?? location;
      const oldVal = data?.old_on_hand;
      const newVal = data?.new_on_hand;

      if (typeof oldVal === "number" && typeof newVal === "number") {
        setSubmitStatus(`✅ ${mode} ${safeQty} — ${name} @ ${locName} | ${oldVal} → ${newVal}`);
      } else {
        setSubmitStatus(`✅ ${mode} ${safeQty} — ${name} @ ${locName}`);
      }

      setItemOrBarcode("");
      setQty(1);

      await loadTotals();
    } catch (e: any) {
      setSubmitStatus(`❌ ${e?.message ?? "Request failed"}`);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 20, fontFamily: "system-ui" }}>
      <h2>Inventory</h2>

      {/* PIN / LOCK */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{isUnlocked ? "🔓 Location Unlocked" : "🔒 Location Locked"}</strong>
          <button onClick={lockNow} style={{ padding: "6px 10px", fontWeight: 800 }}>
            Lock
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            inputMode="numeric"
            style={{ flex: 1, padding: 10 }}
          />
          <button onClick={handleUnlock} style={{ padding: "10px 12px", fontWeight: 900 }}>
            Unlock
          </button>
        </div>

        <div style={{ marginTop: 8, opacity: 0.85 }}>
          {unlockStatus || "Enter PIN to unlock location changes."}
        </div>
      </div>

      {/* LOCATION */}
      <label style={{ display: "block" }}>Location</label>
      <select
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        disabled={!isUnlocked}
        style={{ width: "100%", padding: 10, opacity: isUnlocked ? 1 : 0.6 }}
      >
        <option>Main Sterile Supply</option>
        <option>OR 1 - Cabinet A</option>
        <option>OR 2 - Cabinet A</option>
        <option>Pre-Op</option>
        <option>PACU</option>
      </select>

      {/* MODE */}
      <label style={{ display: "block", marginTop: 12 }}>Mode</label>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setMode("USE")}
          style={{ flex: 1, padding: 10, fontWeight: 900, opacity: mode === "USE" ? 1 : 0.5 }}
        >
          USE
        </button>
        <button
          onClick={() => setMode("RESTOCK")}
          style={{ flex: 1, padding: 10, fontWeight: 900, opacity: mode === "RESTOCK" ? 1 : 0.5 }}
        >
          RESTOCK
        </button>
      </div>

      {/* ITEM */}
      <label style={{ display: "block", marginTop: 12 }}>Item / Barcode</label>
      <input
        value={itemOrBarcode}
        onChange={(e) => setItemOrBarcode(e.target.value)}
        placeholder="Type item name or exact barcode"
        style={{ width: "100%", padding: 10 }}
      />

      {/* QTY */}
      <label style={{ display: "block", marginTop: 12 }}>Qty</label>
      <input
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        type="number"
        min={1}
        style={{ width: "100%", padding: 10 }}
      />

      <button
        onClick={handleSubmit}
        style={{ width: "100%", marginTop: 16, padding: 12, fontWeight: 950 }}
      >
        Submit {mode}
      </button>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        {submitStatus}
      </div>

      {/* TOTAL INVENTORY LIST */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Total Inventory (All Locations)</strong>
          <button onClick={loadTotals} style={{ padding: "6px 10px", fontWeight: 800 }}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          {listStatus ? (
            <div style={{ opacity: 0.75 }}>{listStatus}</div>
          ) : rows.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No items found.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.item_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{r.item_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.barcode ?? ""}</div>
                </div>
                <div style={{ fontWeight: 900 }}>{r.total_on_hand}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
