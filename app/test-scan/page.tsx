"use client";

import { useState } from "react";
import CameraScanner from "../app/CameraScanner";

export default function TestScanPage() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Scanner Test</h1>

      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 16,
          padding: "12px 16px",
          fontSize: 16,
          fontWeight: 800,
          borderRadius: 12,
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Open Scanner
      </button>

      {code && (
        <div style={{ marginTop: 16 }}>
          <b>Scanned code:</b> {code}
        </div>
      )}

      <CameraScanner
        open={open}
        onClose={() => setOpen(false)}
        onDetected={(text) => {
          setCode(text);
          setOpen(false);
        }}
      />
    </div>
  );
}
