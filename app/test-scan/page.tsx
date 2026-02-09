"use client";

import { useState } from "react";
import CameraScanner from "../app/CameraScanner";

export default function TestScanPage() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: 20 }}>
      <h1>Test Camera</h1>

      <button onClick={() => setOpen((v) => !v)}>
        {open ? "Close Camera" : "Open Camera"}
      </button>

      {open && <CameraScanner />}
    </div>
  );
}
