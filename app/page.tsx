"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = { id: string; name: string };
type ScanType = "IN" | "OUT";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Camera / scan
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const canBarcodeDetect = useMemo(() => {
    // @ts-expect-error: BarcodeDetector is not in TS DOM types everywhere
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  }, []);

  useEffect(() => {
    (async () => {
      setErr("");
      setMsg("");
      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name", { ascending: true });

      if (error) {
        setErr(`Could not load locations: ${error.message}`);
        return;
      }
      const list = (data ?? []) as LocationRow[];
      setLocations(list);
      if (!locationId && list.length) setLocationId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doScan() {
    setErr("");
    setMsg("");

    if (!locationId) return setErr("Pick a location first.");
    if (!barcode.trim()) return setErr("Enter a barcode.");
    if (!qty || qty <= 0) return setErr("Qty must be 1 or more.");

    setBusy(true);
    try {
      // Call your Postgres function
      const { error } = await supabase.rpc("scan_item", {
        p_barcode: barcode.trim(),
        p_location: locationId,
        p_type: scanType,
        p_qty: qty,
      });

      if (error) {
        setErr(error.message);
      } else {
        setMsg(`✅ ${scanType} ${qty} recorded for barcode ${barcode.trim()}`);
        setBarcode("");
        setQty(1);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openCamera() {
    setErr("");
    setMsg("");

    if (!canBarcodeDetect) {
      setErr(
        "Camera scan isn’t supported in this browser. Try Chrome/Edge, or we can add a scanner library next."
      );
      return;
    }

    try {
      setCameraStatus("Requesting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraOpen(true);
      setCameraStatus("Point camera at barcode…");

      // @ts-expect-error
      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
      });

      const loop = async () => {
        if (!videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes?.length) {
            const val = barcodes[0]?.rawValue?.trim();
            if (val) {
              setBarcode(val);
              setCameraStatus(`Captured: ${val}`);
              await closeCamera();
              return;
            }
          }
        } catch {
          // ignore detection errors; keep looping
        }
        scanLoopRef.current = window.setTimeout(loop, 150);
      };

      loop();
    } catch (e: any) {
      setErr(`Camera error: ${e?.message ?? String(e)}`);
      await closeCamera();
    }
  }

  async function closeCamera() {
    if (scanLoopRef.current) {
      window.clearTimeout(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraStatus("");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
        ASC Inventory Live
      </h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Scan IN/OUT updates on-hand instantly and flags LOW stock automatically.
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Location</span>
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
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Scan Type</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setScanType("OUT")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: scanType === "OUT" ? "#111" : "#fff",
                  color: scanType === "OUT" ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                OUT (use)
              </button>
              <button
                type="button"
                onClick={() => setScanType("IN")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: scanType === "IN" ? "#111" : "#fff",
                  color: scanType === "IN" ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                IN (restock)
              </button>
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Barcode</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Type or scan barcode…"
                style={{ flex: 1, minWidth: 240, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
              <button
                type="button"
                onClick={openCamera}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Use Camera
              </button>
            </div>
            {cameraStatus ? (
              <div style={{ color: "#444", fontSize: 13 }}>{cameraStatus}</div>
            ) : null}
          </label>

          <label style={{ display: "grid", gap: 6, maxWidth: 200 }}>
            <span style={{ fontWeight: 600 }}>Qty</span>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={(e) => setQty(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={doScan}
              disabled={busy}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {busy ? "Working…" : "Submit Scan"}
            </button>

            {cameraOpen ? (
              <button
                type="button"
                onClick={closeCamera}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Close Camera
              </button>
            ) : null}
          </div>

          {err ? (
            <div style={{ background: "#ffe8e8", border: "1px solid #ffb4b4", padding: 12, borderRadius: 12 }}>
              <strong>Error:</strong> {err}
            </div>
          ) : null}

          {msg ? (
            <div style={{ background: "#e9ffe9", border: "1px solid #b7ffb7", padding: 12, borderRadius: 12 }}>
              {msg}
            </div>
          ) : null}
        </div>
      </section>

      {cameraOpen ? (
        <section style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Camera</div>
          <video
            ref={videoRef}
            playsInline
            style={{ width: "100%", borderRadius: 12, border: "1px solid #ccc" }}
          />
          <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
            If camera scanning doesn’t work on your device/browser, tell me and I’ll add a ZXing scanner (works on most phones).
          </div>
        </section>
      ) : null}
    </main>
  );
}

