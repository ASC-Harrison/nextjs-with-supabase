"use client";

import { useEffect, useMemo, useState } from "react";

type StorageArea = { id: string; name: string };

export default function ProtectedPage() {
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");

  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [oneTimeSourceId, setOneTimeSourceId] = useState<string | null>(null);

  const [mode, setMode] = useState<"use" | "restock">("use");
  const [itemText, setItemText] = useState("");
  const [qty, setQty] = useState(1);

  const [status, setStatus] = useState("Ready");

  // Helper: find “Main Sterile Supply” by name (adjust if your exact name differs)
  const mainSupplyId = useMemo(() => {
    const match = storageAreas.find((s) =>
      s.name.toLowerCase().includes("main") &&
      s.name.toLowerCase().includes("sterile")
    );
    return match?.id ?? null;
  }, [storageAreas]);

  async function loadStorageAreas() {
    setStatus("Loading storage areas...");
    const res = await fetch("/api/storage-areas", { cache: "no-store" });
    const json = await res.json();

    if (!res.ok || !json?.ok) {
      setStatus(`Failed loading storage areas: ${json?.error ?? res.status}`);
      return;
    }

    // IMPORTANT: NO FILTERING. Use the master list exactly as returned.
    const list: StorageArea[] = json.storageAreas ?? [];
    setStorageAreas(list);

    // Default selection (first item) if none selected
    if (!selectedAreaId && list.length > 0) {
      setSelectedAreaId(list[0].id);
    }

    setStatus(`Loaded ${json.count ?? list.length} storage areas`);
  }

  useEffect(() => {
    loadStorageAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock() {
    setStatus("Unlocking...");
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setStatus(`Unlock failed: ${json?.error ?? res.status}`);
      return;
    }
    setLocked(false);
    setPin("");
    setStatus("Unlocked");
  }

  async function lock() {
    setLocked(true);
    setOneTimeSourceId(null);
    setStatus("Locked");
    // If you have an /api/lock route you can call it, but not required for UI lock.
    try {
      await fetch("/api/lock", { method: "POST" });
    } catch {}
  }

  async function submitTransaction() {
    setStatus("Submitting...");

    const sourceId = oneTimeSourceId ?? selectedAreaId;

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,                 // "use" or "restock"
        qty,
        item: itemText,       // name or barcode text
        storage_area_id: selectedAreaId, // your default/current area (cabinet)
        source_area_id: sourceId,        // where to actually pull from (override or same)
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setStatus(`Transaction failed: ${json?.error ?? res.status}`);
      return;
    }

    // One-time override resets after one submit
    setOneTimeSourceId(null);
    setStatus("Submitted ✅");
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Baxter ASC Inventory</h1>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            Cabinet tracking + building totals + low stock alerts
          </div>
        </div>
        <button
          onClick={loadStorageAreas}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Left: Lock + Location */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>
              {locked ? "🔒 Location Locked" : "🔓 Location Unlocked"}
            </div>
            {locked ? (
              <button onClick={unlock} style={btnDark}>Unlock</button>
            ) : (
              <button onClick={lock} style={btnLight}>Lock</button>
            )}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              type="password"
              style={inputStyle}
            />
            {locked ? (
              <button onClick={unlock} style={btnDark}>Unlock</button>
            ) : (
              <button onClick={lock} style={btnLight}>Lock</button>
            )}
          </div>

          <div style={{ marginTop: 14, fontWeight: 700 }}>Default location</div>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            disabled={locked}
            style={{
              ...inputStyle,
              width: "100%",
              marginTop: 8,
              opacity: locked ? 0.6 : 1,
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            {/* IMPORTANT: this renders ALL storage areas returned */}
            {storageAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 14, fontWeight: 700 }}>One-time override</div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            If you had to grab it from Main Sterile Supply while your default is a cabinet.
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                if (!mainSupplyId) {
                  setStatus("Could not find Main Sterile Supply name in storage_areas.");
                  return;
                }
                setOneTimeSourceId(mainSupplyId);
                setStatus("Next submit will pull from Main Sterile Supply (one-time)");
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ccc",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ⚡ MAIN (1x)
            </button>

            <button
              onClick={() => {
                setOneTimeSourceId(null);
                setStatus("Override cleared");
              }}
              style={btnLight}
            >
              Cancel
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 14 }}>
            <b>Source for next submit:</b>{" "}
            {oneTimeSourceId
              ? storageAreas.find((s) => s.id === oneTimeSourceId)?.name ?? "Main (override)"
              : storageAreas.find((s) => s.id === selectedAreaId)?.name ?? "—"}
          </div>
        </div>

        {/* Right: Transaction */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Transaction</div>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => setMode("use")}
              style={{
                ...btnMode,
                background: mode === "use" ? "#b00020" : "#f2f2f2",
                color: mode === "use" ? "white" : "black",
              }}
            >
              ⛔ USE
            </button>
            <button
              onClick={() => setMode("restock")}
              style={{
                ...btnMode,
                background: mode === "restock" ? "#1b5e20" : "#f2f2f2",
                color: mode === "restock" ? "white" : "black",
              }}
            >
              ➕ RESTOCK
            </button>
          </div>

          <input
            value={itemText}
            onChange={(e) => setItemText(e.target.value)}
            placeholder="Item name or barcode"
            style={{ ...inputStyle, width: "100%" }}
          />

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Quantity</div>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={(e) => setQty(Number(e.target.value || 1))}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>

          <button
            onClick={submitTransaction}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Submit {mode.toUpperCase()}
          </button>

          <div style={{ marginTop: 10, opacity: 0.8 }}>{status}</div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ccc",
  outline: "none",
};

const btnDark: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "#111",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const btnLight: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const btnMode: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ccc",
  cursor: "pointer",
  fontWeight: 800,
  flex: 1,
};
