"use client";

import { useEffect, useMemo, useState } from "react";

const UNLOCK_MINUTES = 30;

type InvRow = {
  item_id: string;
  location_id: string;
  on_hand: number;
  status: string | null;
  item_name: string;
  barcode: string | null;
  location_name: string;
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
  const [rows, setRows] = useState<InvRow[]>([]);
  const [listStatus, setListStatus] = useState("Loading inventory...");

  useEffect(() => {
    const until = Number(localStorage.getItem("unlockedUntil") || "0");
    setIsUnlocked(Date.now() < until);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const until = Number(localStorage.getItem("unlockedUntil") || "0");
      setIsUnlocked(Date.now() < until);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const canSubmit = useMemo(() => {
    return location.trim() && itemOrBarcode.trim() && qty >= 1;
  }, [location, itemOrBarcode, qty]);

  async function loadInventory() {
    setListStatus("Loading inventory...");
    const res = await fetch(`/api/items?location=${encodeURIComponent(location)}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setRows([]);
      setListStatus(`❌ ${data?.error ?? `Failed (${res.status})`}`);
      return;
    }

    setRows(data.rows ?? []);
    setListStatus("");
  }

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  async function handleUnlock() {
    setUnlockStatus("Unlocking...");

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setUnlockStatus(`❌ ${data?.error ?? `Unlock failed (${res.status})`}`);
      return;
    }

    const until = Date.now() + UNLOCK_MINUTES * 60 * 1000;
    localStorage.setItem("unlockedUntil", String(until));
    setIsUnlocked(true);
    setPin("");
    setUnlockStatus(`✅ Unlocked for ${UNLOCK_MINUTES} minutes`);
  }

  function handleLock() {
    localStorage.removeItem("unlockedUntil");
    setIsUnlocked(false);
    setUnlockStatus("🔒 Locked");
  }

  async function handleSubmit() {
    if (!canSubmit) return;

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
      setSubmitStatus(`❌ ${data?.error ?? `Request failed (${res.status})`}`);
      return;
    }

    setSubmitStatus(
      `✅ ${data.mode} ${data.qty} — ${data.item?.name ?? "Item"} @ ${data.location?.name ?? location} | ${data.old_on_hand} → ${data.new_on_hand}`
    );

    setItemOrBarcode("");
    setQty(1);

    await loadInventory();
  }

  return (
    <div style={{ maxWidth: 560, margin: "20px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2>Inventory</h2>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{isUnlocked ? "🔓 Location Unlocked" : "🔒 Location Locked"}</strong>
          <button onClick={handleLock} style={{ padding: "6px 10px", fontWeight: 800 }}>
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

        <div style={{ marginTop: 8 }}>{unlockStatus || "Enter PIN to unlock location changes."}</div>
      </div>

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

      <label style={{ display: "block", marginTop: 12 }}>Item / Barcode</label>
      <input
        value={itemOrBarcode}
        onChange={(e) => setItemOrBarcode(e.target.value)}
        placeholder="Type item name or exact barcode"
        style={{ width: "100%", padding: 10 }}
      />

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
        disabled={!canSubmit}
        style={{ width: "100%", marginTop: 16, padding: 12, fontWeight: 950 }}
      >
        Submit {mode}
      </button>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        {submitStatus}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Inventory for {location}</strong>
          <button onClick={loadInventory} style={{ padding: "6px 10px", fontWeight: 800 }}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          {listStatus ? (
            <div style={{ opacity: 0.75 }}>{listStatus}</div>
          ) : rows.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No items found for this location.</div>
          ) : (
            rows.map((r) => (
              <div
                key={`${r.item_id}-${r.location_id}`}
                style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{r.item_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.barcode ?? ""}</div>
                </div>
                <div style={{ fontWeight: 900 }}>{r.on_hand}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
