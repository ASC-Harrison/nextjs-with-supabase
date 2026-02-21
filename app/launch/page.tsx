"use client";

import { useEffect, useMemo, useState } from "react";

const LS = {
  PIN: "asc_pin_v1",
  LOCKED: "asc_locked_v1",
  AREA: "asc_area_id_v1",
  LAUNCHED: "asc_launched_v1",
};

export default function LaunchPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const realPin = useMemo(() => {
    try {
      return localStorage.getItem(LS.PIN) || "1234";
    } catch {
      return "1234";
    }
  }, []);

  useEffect(() => {
    // If you already launched once on this device, you can auto-forward.
    // Comment this out if you ALWAYS want to require PIN.
    try {
      const launched = localStorage.getItem(LS.LAUNCHED) === "1";
      if (launched) {
        window.location.href = "/inventory";
      }
    } catch {}
  }, []);

  function submit() {
    setError("");
    const cleaned = pin.replace(/\D/g, "").slice(0, 6);

    if (cleaned.length < 4) {
      setError("Enter your 4+ digit PIN.");
      return;
    }

    if (cleaned !== realPin) {
      setError("Wrong PIN.");
      return;
    }

    try {
      // Unlock the app on this device
      localStorage.setItem(LS.LOCKED, "0");
      localStorage.setItem(LS.LAUNCHED, "1");
    } catch {}

    window.location.href = "/inventory";
  }

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
        <h1 className="text-2xl font-extrabold">Enter PIN</h1>
        <p className="mt-1 text-sm text-white/70">Unlock inventory on this device.</p>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="PIN"
          className="mt-4 w-full rounded-2xl bg-white text-black px-4 py-3 text-lg font-semibold"
        />

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <button
          onClick={submit}
          className="mt-4 w-full rounded-2xl bg-white text-black px-4 py-3 font-bold"
        >
          Launch Inventory
        </button>

        <div className="mt-3 text-xs text-white/50">
          Default PIN is <span className="font-semibold">1234</span> until changed in Settings.
        </div>
      </div>
    </main>
  );
}
