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

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    readerRef.current.decodeFromVideoDevice(
      undefined,
      videoRef.current!,
      (result, error) => {
        if (result) {
          onDetected(result.getText());
          onClose();
        }
      }
    );

    return () => {
      readerRef.current?.reset();
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
