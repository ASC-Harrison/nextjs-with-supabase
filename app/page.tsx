"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = { id: string; name: string };
type ScanType = "IN" | "OUT";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [barcode, setBarcode] = useState<string>("");
  // ✅ IMPORTANT: store qty as string, always.
  const [qty, setQty] = useState<string>("");

  const [scanType, setScanType] = useState<ScanType>("OUT");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Camera (optional)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const startCamera = async () => {
    try {
      setCameraStatus("Requesting camera…");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraOpen(true);
      setCameraStatus("Camera running");
    } catch (e) {
      setCameraStatus("Camera not supported or permission denied");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraStatus("");
  };

 

  // Load locations on page load
  useEffect(() => {
    (async () => {
      setErr("");
      setMsg("");

      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name", { ascending: true });

      if (error) {
        setErr(`Failed to load locations: ${error.message}`);
        return;
      }

      const rows = (data ?? []) as LocationRow[];
      setLocations(rows);
      if (!locationId && rows.length) setLocationId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop camera on unmount / close
  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

    if (scanLoopRef.current) {
      window.clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("");
  }

  async function startCamera() {
    setErr("");
    setMsg("");

    if (!canBarcodeDetect) {
      setErr("BarcodeDetector is not supported on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraStatus("Camera running… point at barcode");

      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"] });

      // Scan loop
      scanLoopRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current) return;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes?.length) {
            const val = String(barcodes[0].rawValue ?? "").trim();
            if (val) {
              setBarcode(val);
              setCameraStatus(`Scanned: ${val}`);
              setCameraOpen(false); // auto-close camera
            }
          }
        } catch {
          // ignore detection errors
        }
      }, 400);
    } catch (e: any) {
      setErr(`Camera error: ${e?.message ?? "unknown"}`);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr("");
    setMsg("");

    if (busy) return;
    setBusy(true);

    try {
      const cleanedBarcode = barcode.trim();
      if (!cleanedBarcode) {
        setErr("Barcode is required.");
        return;
      }
      if (!locationId) {
        setErr("Location is required.");
        return;
      }

      // ✅ Convert qty here ONLY (never default to 10)
      const qtyNum = Number(qty);

      if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
        setErr("Qty must be a whole number greater than 0.");
        return;
      }

      // Find item by barcode
      const { data: item, error: itemErr } = await supabase
        .from("items")
        .select("item_id,name,barcode")
        .eq("barcode", cleanedBarcode)
        .single();

      if (itemErr || !item) {
        setErr(itemErr?.message ?? "Item not found for that barcode.");
        return;
      }

      // Insert ONE transaction row with the qty you typed
      const { error: txErr } = await supabase.from("transactions").insert([
        {
          type: scanType,
          qty: qtyNum, // ✅ exact qty typed (no 10)
          item_id: item.item_id,
          location_id: locationId,
        },
      ]);

      if (txErr) {
        setErr(txErr.message);
        return;
      }

      setMsg(
        `${scanType} scan saved: ${item.name ?? cleanedBarcode} (${qtyNum}).`
      );

      // Optional: clear barcode, keep qty if you want
      setBarcode("");
      // setQty("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
        ASC Inventory Live
      </h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Scan IN/OUT updates on-hand instantly. LOW flags clear when restocked.
      </p>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
            Location
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10 }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
            Scan Type
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setScanType("OUT")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: scanType === "OUT" ? "#111" : "#fff",
                color: scanType === "OUT" ? "#fff" : "#111",
                fontWeight: 800,
              }}
            >
              OUT (use)
            </button>
            <button
              type="button"
              onClick={() => setScanType("IN")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: scanType === "IN" ? "#111" : "#fff",
                color: scanType === "IN" ? "#fff" : "#111",
                fontWeight: 800,
              }}
            >
              IN (restock)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
              Barcode
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc" }}
              />
              <button
                type="button"
                onClick={() => {
                  setCameraOpen((v) => !v);
                  setTimeout(() => {
                    // start camera after state change
                    if (!cameraOpen) startCamera();
                  }, 0);
                }}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontWeight: 800,
                  background: "#fff",
                }}
              >
                Use Camera
              </button>
            </div>

            {cameraOpen && (
              <div style={{ marginTop: 10 }}>
                <video
                  ref={videoRef}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #ddd" }}
                  muted
                  playsInline
                />
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  {cameraStatus || "Starting camera…"}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
              Qty
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 7"
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc" }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Submitting…" : "Submit Scan"}
          </button>
        </form>

        {err && (
          <div style={{ marginTop: 14, background: "#ffe8e8", border: "1px solid #ffb4b4", padding: 12, borderRadius: 12 }}>
            <strong>Error:</strong> {err}
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 14, background: "#e8fff0", border: "1px solid #9ae6b4", padding: 12, borderRadius: 12 }}>
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
