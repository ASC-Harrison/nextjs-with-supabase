"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CameraScanner from "./CameraScanner";

type StorageArea = { id: string; name: string; active: boolean };
type Item = { id: string; name: string; reference_number?: string | null };

export const dynamic = "force-dynamic";

export default function AppHome() {
  // Locations
  const [areas, setAreas] = useState<StorageArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [storageAreaId, setStorageAreaId] = useState("");

  // Mode
  const [mode, setMode] = useState<"use" | "restock">("use");

  // Item selection (scan or manual)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Qty + submit status
  const [qty, setQty] = useState<number>(1);
  const qtyRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load locations on page load
  useEffect(() => {
    (async () => {
      setLoadingAreas(true);
      try {
        const res = await fetch("/api/storage-areas", { cache: "no-store" });
        const json = await res.json();
        setAreas(json.storage_areas ?? []);
      } catch (e: any) {
        setStatus({ ok: false, msg: e?.message ?? "Failed loading locations" });
      } finally {
        setLoadingAreas(false);
      }
    })();
  }, []);

  // Manual search (type-to-search)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setResults(json.items ?? []);
        else setResults([]);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  const selectedLocationName = useMemo(
    () => areas.find((a) => a.id === storageAreaId)?.name ?? "",
    [areas, storageAreaId]
  );

  async function handleDetectedBarcode(code: string) {
    setScannerOpen(false);
    setLastScan(code);
    setStatus(null);

    try {
      const res = await fetch(`/api/items/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await res.json();

      if (!json.ok) {
        setStatus({ ok: false, msg: json.error ?? "Lookup failed" });
        return;
      }

      if (json.found) {
        setSelectedItem(json.item);
        setQuery("");
        setResults([]);
        setStatus({ ok: true, msg: `Scanned & matched: ${json.item.name}` });
        setTimeout(() => {
          qtyRef.current?.focus();
          qtyRef.current?.select();
        }, 50);
      } else {
        setSelectedItem(null);
        setStatus({ ok: false, msg: `Scanned "${code}" but no match. Use manual search.` });
      }
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? "Lookup error" });
    }
  }

  async function submit() {
    setStatus(null);

    if (!storageAreaId) {
      setStatus({ ok: false, msg: "Pick a location first." });
      return;
    }

    if (!selectedItem) {
      setStatus({ ok: false, msg: "Scan or search and select an item first." });
      return;
    }

    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setStatus({ ok: false, msg: "Qty must be greater than 0." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          storage_area_id: storageAreaId,
          item_id: selectedItem.id,
          qty: q,
        }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        setStatus({ ok: false, msg: json?.error ?? "Failed" });
      } else {
        setStatus({ ok: true, msg: "Success." });
        setSelectedItem(null);
        setQuery("");
        setResults([]);
        setLastScan("");
        setQty(1);
      }
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "20px auto", padding: 16 }}>
      <CameraScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleDetectedBarcode} />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>ASC Inventory</h1>
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer", fontWeight: 800 }}
          >
            Lock
          </button>
        </form>
      </div>

      {/* Location */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Location</div>
        {loadingAreas ? (
          <div>Loading locations…</div>
        ) : (
          <select
            value={storageAreaId}
            onChange={(e) => setStorageAreaId(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
          >
            <option value="">— Select a location —</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        {selectedLocationName ? (
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Selected: <b>{selectedLocationName}</b>
          </div>
        ) : null}
      </div>

      {/* Mode */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Mode</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMode("use")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
              fontWeight: 900,
              opacity: mode === "use" ? 1 : 0.6,
            }}
          >
            USE (subtract)
          </button>
          <button
            type="button"
            onClick={() => setMode("restock")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
              fontWeight: 900,
              opacity: mode === "restock" ? 1 : 0.6,
            }}
          >
            RESTOCK
          </button>
        </div>
      </div>

      {/* Item */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Item</div>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Scan with Camera
        </button>

        {lastScan ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Last scan: <b>{lastScan}</b>
          </div>
        ) : null}

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>OR type to search:</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type item name…"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, marginTop: 6 }}
        />

        {selectedItem ? (
          <div style={{ marginTop: 8, padding: 10, border: "1px solid #ccc", borderRadius: 10 }}>
            Selected: <b>{selectedItem.name}</b>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              style={{ marginLeft: 10, padding: "6px 10px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer", fontWeight: 800 }}
            >
              Change
            </button>
          </div>
        ) : results.length > 0 ? (
          <div style={{ marginTop: 8, border: "1px solid #ccc", borderRadius: 10, overflow: "hidden" }}>
            {results.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setSelectedItem(it);
                  setResults([]);
                  setTimeout(() => {
                    qtyRef.current?.focus();
                    qtyRef.current?.select();
                  }, 50);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  border: "none",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  fontWeight: 700,
                  background: "white",
                }}
              >
                {it.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Qty */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Qty</div>
        <input
          ref={qtyRef}
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        style={{
          marginTop: 14,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 16,
        }}
      >
        {submitting ? "Submitting…" : mode === "use" ? "Submit USE" : "Submit RESTOCK"}
      </button>

      {/* Status */}
      {status ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}>
          <b>{status.ok ? "OK:" : "ERROR:"}</b> {status.msg}
        </div>
      ) : null}
    </div>
  );
}
