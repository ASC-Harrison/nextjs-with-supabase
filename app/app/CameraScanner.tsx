"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function CameraScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    let stopped = false;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (stopped) return;
          const text = result?.getText?.()?.trim();
          if (text) {
            stopped = true;
            onDetected(text);
          }
        });
      } catch (e: any) {
        setError(e?.message ?? "Camera error");
      }
    })();

    return () => {
      stopped = true;
      try {
        readerRef.current?.reset();
      } catch {}
      readerRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Scan Barcode</div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer", fontWeight: 800 }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid #ddd" }}>
          <video ref={videoRef} style={{ width: "100%", height: "auto" }} playsInline muted />
        </div>

        {error ? (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #ccc" }}>
            <b>Camera error:</b> {error}
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              On iPhone: Settings → Safari → Camera → Allow (or allow when prompted).
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            Hold the barcode steady. It will auto-detect.
          </div>
        )}
      </div>
    </div>
  );
}
