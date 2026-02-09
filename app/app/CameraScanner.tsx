"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function CameraScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const didScanRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        readerRef.current = new BrowserMultiFormatReader();

        const controls = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (!result) return;
            if (didScanRef.current) return; // prevent double scans

            didScanRef.current = true;
            onDetected(result.getText());
            onClose();
          }
        );

        controlsRef.current = controls;
      } catch (e) {
        // If camera fails/permission denied, just close the scanner UI
        if (!cancelled) onClose();
      }
    }

    start();

    return () => {
      cancelled = true;
      // ✅ This is the safe cross-version way to stop the camera stream
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, [onDetected, onClose]);

  return (
    <div style={{ marginTop: 10 }}>
      <video
        ref={videoRef}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ccc",
        }}
      />

      <button
        type="button"
        onClick={onClose}
        style={{ marginTop: 10, width: "100%" }}
      >
        Cancel Scan
      </button>
    </div>
  );
}
