"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = {
  id: string;
  name: string;
};

type ScanType = "IN" | "OUT";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState("");
  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* Load locations */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");

      if (error) {
        setErr(error.message);
      } else {
        setLocations(data || []);
        if (data?.length) setLocationId(data[0].id);
      }
    })();
  }, []);

  async function submitScan() {
    setErr("");
    setMsg("");

    if (!barcode.trim()) {
      setErr("Barcode is required");
      return;
    }

    const amount = Math.max(1, parseInt(qty || "1", 10));

    setBusy(true);

    try {
      const { data: item, error: findErr } = await supabase
        .from("inventory")
        .select("id, on_hand, par_level")
        .eq("barcode", barcode)
        .eq("location_id", locationId)
        .single();

      if (findErr || !item) {
        throw new Error("Item not found for this location");
      }

      const newQty =
        scanType === "OUT"
          ? Math.max(0, item.on_hand - amount)
          : item.on_hand + amount;

      const low = newQty <= item.par_level;

      const { error: updateErr } = await supabase
        .from("inventory")
        .update({
          on_hand: newQty,
          low_stock: low
        })
        .eq("id", item.id);

      if (updateErr) throw updateErr;

      setMsg(
        `${scanType} ${amount} → New on-hand: ${newQty}${
          low ? " (LOW)" : ""
        }`
      );
      setBarcode("");
      setQty("1");
    } catch (e: any) {
      setErr(e.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>
        ASC Inventory Live
      </h1>
      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Scan IN / OUT updates on-hand instantly. LOW clears when restocked.
      </p>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <label>
          <strong>Location</strong>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: 16 }}>
          <strong>Scan Type</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => setScanType("OUT")}
              style={{
                flex: 1,
                padding: 10,
                background: scanType === "OUT" ? "#000" : "#eee",
                color: scanType === "OUT" ? "#fff" : "#000",
                borderRadius: 8
              }}
            >
              OUT (use)
            </button>
            <button
              onClick={() => setScanType("IN")}
              style={{
                flex: 1,
                padding: 10,
                background: scanType === "IN" ? "#000" : "#eee",
                color: scanType === "IN" ? "#fff" : "#000",
                borderRadius: 8
              }}
            >
              IN (restock)
            </button>
          </div>
        </div>

        <label style={{ display: "block", marginTop: 16 }}>
          <strong>Barcode</strong>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          <strong>Qty</strong>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        <button
          disabled={busy}
          onClick={submitScan}
          style={{
            marginTop: 16,
            width: "100%",
            padding: 12,
            background: "#000",
            color: "#fff",
            borderRadius: 10
          }}
        >
          {busy ? "Processing…" : "Submit Scan"}
        </button>

        {err && (
          <div style={{ color: "#b00020", marginTop: 12 }}>
            Error: {err}
          </div>
        )}
        {msg && (
          <div style={{ color: "#0a7a0a", marginTop: 12 }}>
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
