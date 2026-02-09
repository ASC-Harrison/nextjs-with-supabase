"use client";

import { useState } from "react";
import CameraScanner from "../CameraScanner";

export default function TestScanPage() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: 20 }}>
      <h1>Test Camera Scan</h1>

      <button onClick={() => setOpen(!open)}>
        {open ? "Close Camera" : "Open Camera"}
      </button>

      {open && <CameraScanner />}
    </div>
  );
}
