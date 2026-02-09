"use client";

import { useEffect, useMemo, useState } from "react";
import CameraScanner from "./CameraScanner";

type StorageArea = {
  id: string;
  name: string;
  active: boolean;
};

type Item = {
  id: string;
  name: string;
  reference_number: string | null;
};

type Mode = "USE" | "RESTOCK";

export default function AppPage() {
  const [areas, setAreas] = useState<StorageArea[]>([]);
  const [areaId, setAreaId] = useState<string>("");

  const [mode, setMode] = useState<Mode>("USE");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [qty, setQty] = useState<number>(1);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // -----------------------------
  // Load storage areas
  // -----------------------------
  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to load locations");

        const list: StorageArea[] = json.storage_areas ?? [];
        setAreas(list);

        // auto-select first active if none chosen
        if (!areaId) {
          const first = list.find((a) => a.active) || list[0];
          if (first) setAreaId(first.id);
        }
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load locations");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === areaId) || null,
    [areas, areaId]
  );

  // -----------------------------
  // Item search by name (manual)
  // -----------------------------
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      try {
        setErr("");
        const res = await fetch(`/api/items?query=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Search failed");
        setResults(json.items ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Search failed");
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  // -----------------------------
  // Barcode scan handler
  // -----------------------------
  async function onBarcode(barcode: string) {
    try {
      setErr("");
      setMsg("");
      setScannerOpen(false);

      const clean = (barcode || "").trim();
      if (!clean) return;

      // Lookup item by barcode in DB
      const res = await fetch(`/api/items?barcode=${encodeURIComponent(clean)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Barcode lookup failed");

      const item: Item | null = json.item ?? null;
      if (!item) {
        setErr(`No item found for barcode: ${clean}`);
        return;
      }

      setSelectedItem(item);
      setQuery(item.name); // helpful UX
      setResults([]);
      setMsg(`Selected: ${item.name}`);
    } catch (e: any) {
      setErr(e?.message ?? "Scan failed");
    }
  }

  // -----------------------------
  // Submit USE / RESTOCK
  // -----------------------------
  async function submit() {
    try {
      setErr("");
      setMsg("");

      if (!areaId) {
        setErr("Select a location first.");
        return;
      }
      if (!selectedItem?.id) {
        setErr("Scan or search and select an item first.");
        return;
      }
      const n = Number(qty);
      if (!Number.isFinite(n) || n <= 0) {
        setErr("Qty must be greater than 0.");
        return;
      }

      setBusy(true);

      // IMPORTANT: relative URL only (prevents Safari URL pattern error)
      const res = await fetch("/api/submit-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          storage_area_id: areaId,
          item_id: selectedItem.id,
          qty: n,
          mode, // "USE" or "RESTOCK"
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Submit failed");

      setMsg(
        `${mode === "USE" ? "Used" : "Restocked"} ${n} × ${selectedItem.name} (${selectedArea?.name || "Location"})`
      );
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>ASC Inventory</h1>
        <button type="button">Lock</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 700 }}>Location</label>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        >
          <option value="">— Select a location —</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          Selected: <b>{selectedArea?.name || "—"}</b>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 700 }}>Mode</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setMode("USE")}
            style={{
              flex: 1,
              padding: 12,
              border: "1px solid #ccc",
              background: mode === "USE" ? "#f2f2f2" : "white",
              fontWeight: 800,
            }}
          >
            USE (subtract)
          </button>
          <button
            type="button"
            onClick={() => setMode("RESTOCK")}
            style={{
              flex: 1,
              padding: 12,
              border: "1px solid #ccc",
              background: mode === "RESTOCK" ? "#f2f2f2" : "white",
              fontWeight: 800,
            }}
          >
            RESTOCK
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 700 }}>Item</label>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          style={{ width: "100%", padding: 14, marginTop: 8, fontWeight: 800 }}
        >
          Scan with Camera
        </button>

        {scannerOpen && (
          <div style={{ marginTop: 10 }}>
            <CameraScanner
              onDetected={(code: string) => onBarcode(code)}
              onClose={() => setScannerOpen(false)}
            />
          </div>
        )}

        <div style={{ marginTop: 12, opacity: 0.75 }}>OR type to search:</div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedItem(null); // force reselect if user changes text
          }}
          placeholder="Type item name..."
          style={{ width: "100%", padding: 12, marginTop: 8 }}
        />

        {selectedItem ? (
          <div style={{ border: "1px solid #ddd", padding: 12, marginTop: 10, borderRadius: 10 }}>
            <div>
              Selected: <b>{selectedItem.name}</b>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedItem(null);
                setResults([]);
                setQuery("");
              }}
              style={{ marginTop: 8 }}
            >
              Change
            </button>
          </div>
        ) : results.length > 0 ? (
          <div style={{ border: "1px solid #ddd", borderRadius: 10, marginTop: 10 }}>
            {results.slice(0, 8).map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setSelectedItem(it);
                  setQuery(it.name);
                  setResults([]);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 12,
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #eee",
                  background: "white",
                }}
              >
                <b>{it.name}</b>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {it.reference_number ? `Ref: ${it.reference_number}` : "No ref #"}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 700 }}>Qty</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ width: "100%", padding: 12, marginTop: 8 }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            padding: 14,
            fontWeight: 900,
            opacity: busy ? 0.6 : 1,
          }}
        >
          Submit {mode}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f2c7c7", borderRadius: 10 }}>
          <b>ERROR:</b> {err}
        </div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #c7f2cf", borderRadius: 10 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
