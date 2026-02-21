"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LS = { PIN: "asc_pin_v1" };

export default function HomePage() {
  const router = useRouter();

  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // Optional: show the user a hint if they never set a PIN
  const [hasCustomPin, setHasCustomPin] = useState(false);
  useEffect(() => {
    try {
      setHasCustomPin(!!localStorage.getItem(LS.PIN));
    } catch {}
  }, []);

  function openPinGate() {
    setPinInput("");
    setPinError("");
    setPinOpen(true);
  }

  function checkPin() {
    try {
      const real = localStorage.getItem(LS.PIN) || "1234"; // default
      if (pinInput.trim() !== real) {
        setPinError("Wrong PIN");
        return;
      }
      setPinOpen(false);
      router.push("/inventory");
    } catch {
      setPinError("PIN check failed");
    }
  }

  return (
    <div className="min-h-screen w-full flex justify-center">
      <div
        className="w-full max-w-md px-3 pb-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-4xl font-extrabold leading-none">
            Baxter ASC
            <br />
            Inventory
          </div>

          <div className="mt-3 text-sm text-white/60">
            Cabinet tracking + building totals + low stock alerts
          </div>

          <div className="mt-5 grid gap-3">
            {/* Inventory app button (PIN gated) */}
            <button
              onClick={openPinGate}
              className="w-full rounded-2xl bg-white px-4 py-4 text-black font-semibold text-center"
            >
              Launch Inventory App
            </button>

            {/* Marketing/website button */}
            <a
              href="https://ascinventory.com"
              className="w-full rounded-2xl bg-white/10 px-4 py-4 text-white font-semibold text-center ring-1 ring-white/10"
            >
              Open Website
            </a>

            <div className="text-xs text-white/50 text-center">
              Tip: Save <span className="font-semibold">/inventory</span> to your Home Screen for the full-screen app.
              {!hasCustomPin && (
                <>
                  <br />
                  Default PIN is <span className="font-semibold">1234</span> until you set it in Inventory → Settings.
                </>
              )}
            </div>
          </div>
        </div>

        {/* PIN Modal */}
        {pinOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
              <div className="text-lg font-semibold">Enter PIN to open Inventory</div>

              <input
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                className="mt-3 w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="PIN"
                autoFocus
              />

              {pinError && <div className="mt-2 text-sm text-red-400">{pinError}</div>}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPinOpen(false)}
                  className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={checkPin}
                  className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-black"
                >
                  OK
                </button>
              </div>

              <div className="mt-3 text-xs text-white/50">
                PIN is the same one you set inside Inventory → Settings.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
