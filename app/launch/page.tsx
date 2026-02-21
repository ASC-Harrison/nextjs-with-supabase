"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LS = {
  PIN: "asc_pin_v1",
};

export default function LaunchPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // If you want auto-open without PIN later, you can change this logic.
  }, []);

  function checkPin() {
    const real = (localStorage.getItem(LS.PIN) || "1234").trim();
    if (pin.trim() !== real) {
      setErr("Wrong PIN");
      return;
    }
    setErr("");
    router.replace("/"); // ✅ go to the real app page
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="text-2xl font-extrabold">Launch Baxter ASC Inventory</div>
        <div className="mt-2 text-sm text-white/70">
          Enter PIN to continue.
        </div>

        <input
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setErr("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") checkPin();
          }}
          inputMode="numeric"
          placeholder="PIN"
          className="pin-input mt-4 w-full rounded-2xl bg-white px-4 py-3 text-black"
        />

        {err && <div className="mt-2 text-sm text-red-400">{err}</div>}

        <button
          onClick={checkPin}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black"
        >
          Continue
        </button>

        <div className="mt-3 text-xs text-white/50">
          Default PIN is <span className="font-semibold">1234</span> until you change it in Settings.
        </div>
      </div>
    </div>
  );
}
