"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function CameraScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const reader = new BrowserMultiFormatReader();

        // Start decoding from the default camera. iOS will prompt for camera access.
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (!result) return;
            const text = result.getText?.() ?? "";
            if (!text) return;

            // Stop scanning immediately after detecting
            controlsRef.current?.stop();
            controlsRef.current = null;

            onDetected(text);
            onClose();
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message ?? "Camera error");
      }
    }

    // Must have video element present
    if (videoRef.current) start();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    };
  }, [onClose, onDetected]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>Camera Scanner</strong>
        <button onClick={onClose} style={{ padding: "6px 10px" }}>
          Close
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>
      ) : (
        <video
          ref={videoRef}
          style={{
            width: "100%",
            marginTop: 10,
            borderRadius: 12,
            background: "#000",
          }}
          muted
          playsInline
        />
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Tip: hold the barcode steady for 1–2 seconds.
      </div>
    </div>
  );
}

