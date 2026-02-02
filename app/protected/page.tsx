"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

type Location = {
  id: string;
  name: string;
};

export default function ScanPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);
  const [scanType, setScanType] = useState<"IN" | "OUT">("OUT");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLocations();
    inputRef.current?.focus();
  }, []);

  async function loadLocations() {
    const { data, error } = await supabase
      .from("locations")
      .select("id,name")
      .order("name");

    if (!error && data) setLocations(data);
  }

  async function submitScan() {
    if (!locationId || !barcode || qty <= 0) {
      setMsg("Missing required fields");
      return;
    }

    setBusy(true);
    setMsg("");

    const { error } = await supabase.from("inventory_transactions").insert({
      location_id: locationId,
      barcode,
      qty,
      type: scanType,
    });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Scan recorded successfully");
      setBarcode("");
      setQty(1);
      inputRef.current?.focus();
    }

    setBusy(false);
  }

  return (
    <div style={{ padding: 20, maxWidth: 500 }}>
      <h1>ASC Inventory Scan</h1>

      <label>Location</label>
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
      >
        <option value="">Select location</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <label>Barcode</label>
      <input
        ref={inputRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder="Scan barcode"
      />

      <label>Quantity</label>
      <input
        type="number"
        value={qty}
        min={1}
        onChange={(e) => setQty(Number(e.target.value))}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={() => setScanType("OUT")}>
          OUT
        </button>
        <button onClick={() => setScanType("IN")}>
          IN
        </button>
      </div>

      <button disabled={busy} onClick={submitScan} style={{ marginTop: 15 }}>
        Submit Scan
      </button>

      {msg && <p>{msg}</p>}
    </div>
  );
}
