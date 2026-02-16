"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

export default function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setError("");
        const reader = new BrowserMultiFormatReader();

        // Ask ZXing for cameras
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices || devices.length === 0) {
          setError("No camera found on this device.");
          return;
        }

        if (!videoRef.current) return;

        // Prefer back camera if available
        const backCam = devices.find((d) =>
          (d.label || "").toLowerCase().includes("back")
        );
        const deviceId = backCam?.deviceId || devices[0].deviceId;

        controlsRef.current = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              onScan(result.getText());
              onClose();
            }
          }
        );
      } catch (e: any) {
        setError(e?.message || "Camera error. Check permissions in Safari.");
      }
    }

    start();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-neutral-900 p-4 text-white ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">Scan Barcode</div>
          <button
            className="rounded-xl bg-white/10 px-3 py-2 font-semibold ring-1 ring-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-64 w-full object-cover" />
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-500/20">
            {error}
            <div className="mt-2 text-xs text-red-200/80">
              iPhone/iPad: Settings → Safari → Camera → Allow, then refresh.
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-white/70">
            Point the camera at the barcode. It will auto-fill and close.
          </div>
        )}
      </div>
    </div>
  );
}
