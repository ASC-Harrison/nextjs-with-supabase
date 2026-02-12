"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LocationRow = { id: string; name: string };
type ItemRow = { id: string; name: string | null };
type InventoryRow = { item_id: string; location_id: string; on_hand: number; status: string | null };

type TxnType = "PULL" | "RESTOCK";
type Source = "CABINET" | "MAIN_SUPPLY";

export default function InventoryV2Page() {
  // Data
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryRow>>(new Map());

  // Search
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<ItemRow[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Modal
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);
  const [qty, setQty] = useState(1);
  const [txnType, setTxnType] = useState<TxnType>("PULL");
  const [source, setSource] = useState<Source>("CABINET");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // Scanner
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string>("");
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [scanStream, setScanStream] = useState<MediaStream | null>(null);

  // Load locations at start
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name");

      if (error) {
        setMsg(`❌ Locations load error: ${error.message}`);
        return;
      }

      const locs = (data ?? []) as LocationRow[];
      setLocations(locs);

      // pick default location
      const saved = typeof window !== "undefined" ? localStorage.getItem("default_location_id") : null;
      const defaultId = saved && locs.some(l => l.id === saved) ? saved : (locs[0]?.id ?? "");
      setLocationId(defaultId);
    })();
  }, []);

  // Persist location per device
  useEffect(() => {
    if (!locationId) return;
    localStorage.setItem("default_location_id", locationId);
  }, [locationId]);

  // Load inventory for selected location (to show on_hand quickly)
  useEffect(() => {
    if (!locationId) return;

    (async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("item_id,location_id,on_hand,status")
        .eq("location_id", locationId);

      if (error) {
        setMsg(`❌ Inventory load error: ${error.message}`);
        return;
      }

      const map = new Map<string, InventoryRow>();
      for (const r of (data ?? []) as InventoryRow[]) map.set(r.item_id, r);
      setInventoryMap(map);
    })();
  }, [locationId]);

  // Debounced server search for items by name
  useEffect(() => {
    const term = q.trim();
    setMsg("");
    setScanMsg("");

    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoadingSearch(true);

      // IMPORTANT: If your items column is "item_name" instead of "name",
      // change select("id,name") -> select("id,item_name") and ilike("name",...) -> ilike("item_name",...)
      const { data, error } = await supabase
        .from("items")
        .select("id,name")
        .ilike("name", `%${term}%`)
        .limit(25);

      setLoadingSearch(false);

      if (error) {
        setMsg(`❌ Search error: ${error.message}`);
        setSearchResults([]);
        return;
      }

      setSearchResults((data ?? []) as ItemRow[]);
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  const locationName = useMemo(
    () => locations.find(l => l.id === locationId)?.name ?? "—",
    [locations, locationId]
  );

  function badgeFor(itemId: string) {
    const inv = inventoryMap.get(itemId);
    const onHand = inv?.on_hand ?? 0;
    const status = (inv?.status ?? "").toLowerCase();

    let label: "OK" | "LOW" | "OUT" = "OK";
    if (onHand === 0 || status.includes("out")) label = "OUT";
    else if (status.includes("low")) label = "LOW";

    return { label, onHand, statusText: inv?.status ?? null };
  }

  function openTxn(item: ItemRow) {
    setSelectedItem(item);
    setQty(1);
    setTxnType("PULL");
    setSource("CABINET");
    setNote("");
    setMsg("");
    setOpen(true);
  }

  async function submitTxn() {
    if (!selectedItem?.id || !locationId) {
      setMsg("❌ Missing item or location");
      return;
    }
    if (!qty || qty < 1) {
      setMsg("❌ Qty must be 1+");
      return;
    }

    // Optional: PIN gate for MAIN_SUPPLY (quick/simple)
    if (source === "MAIN_SUPPLY") {
      const pin = prompt("Enter PIN for Main Supply:");
      if (!pin) return;
      // TODO: replace with real pin validation later
      // For now, any non-empty PIN passes (so you can run).
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selectedItem.id,
          location_id: locationId,
          qty,
          txn_type: txnType,
          source,
          note: note || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMsg(`❌ Save failed: ${data?.error ?? "Unknown error"}`);
        setSaving(false);
        return;
      }

      setMsg("✅ Saved!");
      setOpen(false);

      // Refresh inventory for this location after a successful txn
      const { data: invData } = await supabase
        .from("inventory")
        .select("item_id,location_id,on_hand,status")
        .eq("location_id", locationId);

      const map = new Map<string, InventoryRow>();
      for (const r of (invData ?? []) as InventoryRow[]) map.set(r.item_id, r);
      setInventoryMap(map);

      // Clear search
      setQ("");
      setSearchResults([]);
    } catch (e: any) {
      setMsg(`❌ Network error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------
  // Camera Scan (BarcodeDetector)
  // ---------------------------
  async function startScan() {
    setScanMsg("");
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setScanMsg("❌ Camera not available in this browser/device.");
      return;
    }
    // BarcodeDetector is supported in Chrome/Edge; iOS Safari is inconsistent.
    // This is “future-ready” but not guaranteed everywhere.
    // If not supported, we still show a clear message.
    // @ts-ignore
    if (typeof window !== "undefined" && !("BarcodeDetector" in window)) {
      setScanMsg("⚠️ Scanner not supported on this browser yet. Use search for now.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setScanStream(stream);
      setScanning(true);

      // Attach to video element
      setTimeout(() => {
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(() => {});
        }
      }, 0);

      // @ts-ignore
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"] });

      const tick = async () => {
        if (!videoEl || !scanning) return;

        try {
          // @ts-ignore
          const barcodes = await detector.detect(videoEl);
          if (barcodes?.length) {
            const raw = barcodes[0].rawValue?.trim?.() ?? "";
            if (raw) {
              setScanMsg(`✅ Scanned: ${raw}`);
              stopScan();

              // If you have items.barcode, you can auto-lookup:
              // const { data } = await supabase.from("items").select("id,name").eq("barcode", raw).limit(1);
              // if (data?.[0]) openTxn(data[0] as ItemRow);

              // For now: put scanned text into search box
              setQ(raw);
              return;
            }
          }
        } catch {
          // ignore detect errors and continue
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    } catch (e: any) {
      setScanMsg(`❌ Camera error: ${e?.message ?? "Unknown error"}`);
    }
  }

  function stopScan() {
    setScanning(false);
    if (scanStream) {
      scanStream.getTracks().forEach((t) => t.stop());
      setScanStream(null);
    }
  }

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
    };
  }, [scanStream]);

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Current Location</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{locationName}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <button
            onClick={scanning ? stopScan : startScan}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 800,
              cursor: "pointer",
              background: "white",
            }}
          >
            {scanning ? "Stop Scan" : "Scan"}
          </button>
        </div>
      </div>

      {scanMsg ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #e5e5e5", borderRadius: 12 }}>
          {scanMsg}
        </div>
      ) : null}

      {scanning ? (
        <div style={{ marginTop: 12 }}>
          <video
            ref={(el) => setVideoEl(el)}
            style={{ width: "100%", maxHeight: 320, borderRadius: 14, border: "1px solid #ddd" }}
            playsInline
            muted
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Point the camera at a barcode/QR. If your browser doesn’t support scanning yet, use search.
          </div>
        </div>
      ) : null}

      {/* Search */}
      <div style={{ marginTop: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type item name… (ex: gauze, suture, scope)"
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 14,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Type at least 2 characters. Results come from Supabase.
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 900 }}>Results</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {loadingSearch ? "Searching…" : `${searchResults.length} shown`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {searchResults.map((item) => {
            const { label, onHand } = badgeFor(item.id);
            return (
              <button
                key={item.id}
                onClick={() => openTxn(item)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #e5e5e5",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 900 }}>{item.name ?? "(no name)"}</div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {label}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                  <div>
                    <span style={{ fontWeight: 800 }}>On hand:</span> {onHand}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {msg ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>{msg}</div>
      ) : null}

      {/* Modal */}
      {open && selectedItem ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => (!saving ? setOpen(false) : null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 16,
              border: "1px solid #ddd",
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Item</div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>{selectedItem.name ?? "(no name)"}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Location: <span style={{ fontWeight: 800 }}>{locationName}</span>
                </div>
              </div>

              <button
                disabled={saving}
                onClick={() => setOpen(false)}
                style={{ border: "1px solid #ccc", background: "white", borderRadius: 10, padding: "8px 10px", fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 900 }}>Type</span>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value as TxnType)}
                  disabled={saving}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  <option value="PULL">Pull</option>
                  <option value="RESTOCK">Restock</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 900 }}>Qty</span>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  disabled={saving}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 900 }}>Source</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}
                  disabled={saving}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  <option value="CABINET">Cabinet</option>
                  <option value="MAIN_SUPPLY">Main Supply (PIN)</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 900 }}>Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={saving}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <button
                onClick={submitTxn}
                disabled={saving}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Submit"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                This submits to <b>/api/transaction</b> which calls your RPC and logs transactions.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
