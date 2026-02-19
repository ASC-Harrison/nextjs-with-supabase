"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type Location = {
  id: string;
  name: string;
};

export default function ProtectedPage() {
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [qty, setQty] = useState(1);
  const [input, setInput] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  /* ---------------- LOAD LOCATIONS ---------------- */

  useEffect(() => {
    fetch("/api/storage-areas")
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        if (data.length > 0) setLocationId(data[0].id);
      })
      .catch(() => setStatus("⚠️ Failed to load locations"));
  }, []);

  /* ---------------- BARCODE SCANNER ---------------- */

  useEffect(() => {
    if (!scannerOpen) return;

    const scanner = new Html5QrcodeScanner(
      "scanner",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        setInput(decodedText);
        setScannerOpen(false);
        scanner.clear();
        submitTransaction(decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerOpen]);

  /* ---------------- SUBMIT ---------------- */

  async function submitTransaction(scanned?: string) {
    const code = (scanned ?? input).trim();
    if (!code) return;

    setStatus("Processing...");

    const res = await fetch("/api/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode: code,
        qty,
        mode,
        locationId
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.code === "ITEM_NOT_FOUND") {
        setStatus(`❌ Not in system: ${code}`);
      } else {
        setStatus(`❌ ${data.error || "Transaction failed"}`);
      }
      return;
    }

    setStatus("✅ Success");
    setInput("");
    setQty(1);
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-black text-white flex justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-6">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Baxter ASC Inventory</h1>
        </div>

        {/* LOCATION SELECT */}
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="w-full bg-neutral-800 p-3 rounded-xl"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {/* MODE + CAMERA ROW */}
        <div className="flex gap-3">
          <button
            onClick={() => setMode("USE")}
            className={`flex-1 p-3 rounded-xl font-bold ${
              mode === "USE" ? "bg-red-600" : "bg-neutral-700"
            }`}
          >
            USE
          </button>

          <button
            onClick={() => setMode("RESTOCK")}
            className={`flex-1 p-3 rounded-xl font-bold ${
              mode === "RESTOCK" ? "bg-green-600" : "bg-neutral-700"
            }`}
          >
            RESTOCK
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            className="p-3 bg-neutral-700 rounded-xl"
          >
            📷
          </button>
        </div>

        {/* INPUT */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scan barcode or type"
          className="w-full p-4 rounded-xl bg-white text-black"
        />

        {/* QTY WITH +/- */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-4 py-3 bg-neutral-700 rounded-xl text-xl"
          >
            −
          </button>

          <input
            type="number"
            value={qty}
            min={1}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="w-full p-4 rounded-xl bg-white text-black text-center"
          />

          <button
            onClick={() => setQty((q) => q + 1)}
            className="px-4 py-3 bg-neutral-700 rounded-xl text-xl"
          >
            +
          </button>
        </div>

        {/* SUBMIT */}
        <button
          onClick={() => submitTransaction()}
          className="w-full bg-white text-black p-4 rounded-xl font-bold"
        >
          Submit
        </button>

        {/* STATUS */}
        {status && (
          <div className="text-center text-yellow-400">{status}</div>
        )}

        {/* SCANNER MODAL */}
        {scannerOpen && (
          <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
            <div className="bg-neutral-900 p-4 rounded-xl w-full max-w-md">
              <div id="scanner" />
              <button
                onClick={() => setScannerOpen(false)}
                className="w-full mt-4 bg-red-600 p-3 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
