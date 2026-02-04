"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * ============
 * ENV REQUIRED
 * ============
 * Create a file: .env.local (in project root, next to package.json)
 *
 * NEXT_PUBLIC_SUPABASE_URL=...
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL) console.warn("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_ANON_KEY) console.warn("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type LocationRow = { id: string; name: string };

type RpcResultRow = {
  on_hand?: number;
  status?: string; // if your rpc returns it
  message?: string; // if you return a message
};

export default function Page() {
  // Data
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  // Form
  const [scanType, setScanType] = useState<"OUT" | "IN">("OUT");
  const [barcode, setBarcode] = useState<string>("");
  const [qty, setQty] = useState<string>("1"); // keep as string

  // UI state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  // Camera / ZXing
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const zxingControlsRef = useRef<any>(null);

  // Load locations on first load
  useEffect(() => {
    (async () => {
      setErr("");
      try {
        const { data, error } = await supabase
          .from("locations")
          .select("id,name")
          .order("name", { ascending: true });

        if (error) throw error;

        const rows = (data ?? []) as LocationRow[];
        setLocations(rows);

        // Auto-pick first location if none selected
        if (!locationId && rows.length > 0) setLocationId(rows[0].id);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load locations.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeBarcode(input: string) {
    return (input ?? "").trim();
  }

  function parseQty(input: string) {
    const n = Number(input);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  async function submitScan() {
    setErr("");
    setMsg("");

    const cleanedBarcode = normalizeBarcode(barcode);
    if (!cleanedBarcode) {
      setErr("Barcode is required.");
      return;
    }

    if (!locationId) {
      setErr("Location is required.");
      return;
    }

    const qtyNum = parseQty(qty);
    if (qtyNum === null) {
      setErr("Qty must be a whole number greater than 0.");
      return;
    }

    setBusy(true);
    try {
      // 1) Find item by barcode (IMPORTANT: include 'id')
      const { data: item, error: itemErr } = await supabase
        .from("items")
        .select("id,name,barcode")
        .eq("barcode", cleanedBarcode)
        .single();

      if (itemErr || !item) {
        throw new Error(itemErr?.message ?? "Item not found for that barcode.");
      }

      // 2) Call your RPC
      //    (IMPORTANT: p_item_id MUST be item.id — NOT item.item_id)
      const clientTxId =
        (globalThis.crypto as any)?.randomUUID?.() ??
        `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const { data, error: rpcErr } = await supabase.rpc("apply_transaction", {
        p_client_tx_id: clientTxId,
        p_item_id: item.id,
        p_location_id: locationId,
        p_qty: qtyNum,
        p_type: scanType, // "IN" or "OUT"
      });

      if (rpcErr) throw new Error(rpcErr.message);

      const row = (Array.isArray(data) ? data[0] : data) as RpcResultRow | null;

      const onHandText =
        row?.on_hand !== undefined ? ` On hand now: ${row.on_hand}` : "";

      const statusText = row?.status ? ` (${row.status})` : "";

      setMsg(
        `${scanType} ${qtyNum} saved for ${item.name ?? "item"}.${
          onHandText
        }${statusText}`
      );

      // optional: clear barcode after submit
      setBarcode("");
      // keep qty as-is or reset to 1
      // setQty("1");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * ==========
   * CAMERA (ZXing)
   * ==========
   * Works on most phones/browsers. Much more reliable than BarcodeDetector.
   * Requires: npm i @zxing/browser @zxing/library
   */
  async function startCamera() {
    setErr("");
    setMsg("");
    setCameraStatus("");

    try {
      if (!videoRef.current) {
        setErr("Video element not ready.");
        return;
      }

      // Lazy import so it doesn’t break build
      const { BrowserMultiFormatReader } = await import("@zxing/browser");

      // Stop any previous session
      stopCamera();

      const codeReader = new BrowserMultiFormatReader();
      setCameraOpen(true);
      setCameraStatus("Starting camera...");

      // decodeFromVideoDevice returns controls (so we can stop it)
      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, controlsInner) => {
          // Keep controls reference updated
          if (controlsInner) zxingControlsRef.current = controlsInner;

          if (result) {
            const text = result.getText?.() ?? String(result);
            setBarcode(normalizeBarcode(text));
            setCameraStatus("Scanned!");
            // Auto-close camera after scan
            stopCamera();
          }
          // ignore decode errors (they happen constantly while scanning)
        }
      );

      zxingControlsRef.current = controls;
      setCameraStatus("Camera running");
    } catch (e: any) {
      setCameraOpen(false);
      setCameraStatus("");
      setErr(
        e?.message ??
          "Camera scanning not supported on this device/browser. Try Chrome/Edge."
      );
    }
  }

  function stopCamera() {
    try {
      // Stop ZXing stream
      if (zxingControlsRef.current?.stop) {
        zxingControlsRef.current.stop();
      }
    } catch {
      // ignore
    } finally {
      zxingControlsRef.current = null;
      setCameraOpen(false);
      setCameraStatus("");
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
        ASC Inventory Live
      </h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Scan IN/OUT updates on-hand instantly. LOW flags clear when restocked.
      </p>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
        }}
      >
        {/* Location */}
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Location
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #d8d8d8",
            marginBottom: 16,
          }}
        >
          {locations.length === 0 ? (
            <option value="">Loading...</option>
          ) : (
            locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))
          )}
        </select>

        {/* Scan Type */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Scan Type</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setScanType("OUT")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #d8d8d8",
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
                border: "1px solid #d8d8d8",
                background: scanType === "IN" ? "#111" : "#fff",
                color: scanType === "IN" ? "#fff" : "#111",
                fontWeight: 800,
              }}
            >
              IN (restock)
            </button>
          </div>
        </div>

        {/* Barcode */}
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Barcode
        </label>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Type or scan barcode..."
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #d8d8d8",
            }}
          />
          {!cameraOpen ? (
            <button
              type="button"
              onClick={startCamera}
              style={{
                width: 140,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #d8d8d8",
                background: "#fff",
                fontWeight: 800,
              }}
            >
              Use Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              style={{
                width: 140,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #d8d8d8",
                background: "#fff",
                fontWeight: 800,
              }}
            >
              Stop Camera
            </button>
          )}
        </div>

        {/* Camera preview */}
        {cameraOpen && (
          <div style={{ marginBottom: 16 }}>
            <video
              ref={videoRef}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid #d8d8d8",
              }}
              muted
              playsInline
            />
            {cameraStatus && (
              <div style={{ marginTop: 8, opacity: 0.8 }}>{cameraStatus}</div>
            )}
          </div>
        )}

        {/* Qty */}
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Qty
        </label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #d8d8d8",
            marginBottom: 16,
          }}
        />

        {/* Submit */}
        <button
          type="button"
          onClick={submitScan}
          disabled={busy}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            border: "none",
            background: busy ? "#444" : "#111",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Working..." : "Submit Scan"}
        </button>

        {/* Messages */}
        {err && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#ffe9e9",
              border: "1px solid #ffb5b5",
              color: "#5a0000",
              fontWeight: 700,
            }}
          >
            Error: {err}
          </div>
        )}

        {msg && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#e9fff0",
              border: "1px solid #b7f1c7",
              color: "#0b4b1a",
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
