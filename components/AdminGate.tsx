"use client";

import { useEffect, useState } from "react";

const LS = { PIN: "asc_pin_v1" };

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    // If you want “always require PIN”, leave this as-is.
    setOk(false);
  }, []);

  function check() {
    const real = localStorage.getItem(LS.PIN) || "1234";
    if (pin.trim() !== real) {
      alert("Wrong PIN");
      return;
    }
    setOk(true);
  }

  if (!ok) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="text-xl font-semibold">Admin Console</div>
          <div className="mt-2 text-sm text-white/70">Enter PIN to continue.</div>

          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="PIN"
            className="mt-4 w-full rounded-2xl bg-white text-black px-4 py-3"
          />

          <button
            onClick={check}
            className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black"
          >
            Unlock
          </button>

          <div className="mt-3 text-xs text-white/50">
            Default PIN is <span className="font-semibold">1234</span> until changed in Settings.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
