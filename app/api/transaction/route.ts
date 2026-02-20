"use client";

import { useState } from "react";

export default function Page() {
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [qty, setQty] = useState(1);
  const [mainOverride, setMainOverride] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8">
      
      {/* HEADER */}
      <div className="pt-6 safe-top">
        <h1 className="text-4xl font-bold">ASC Inventory</h1>
        <p className="mt-2 text-white/70">
          Cabinet tracking + building totals + low stock alerts
        </p>
      </div>

      {/* TABS */}
      <div className="mt-6 flex gap-3">
        <button className="flex-1 rounded-2xl bg-white text-black py-3 font-semibold">
          Transaction
        </button>
        <button className="flex-1 rounded-2xl bg-white/10 py-3">
          Totals
        </button>
        <button className="flex-1 rounded-2xl bg-white/10 py-3">
          Settings
        </button>
      </div>

      {/* CARD */}
      <div className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">

        {/* LOCATION */}
        <p className="text-sm text-white/70">Select location</p>
        <select className="mt-2 w-full rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
          <option>Anesthesia Cart 1</option>
          <option>OR 1 Cabinet A</option>
          <option>Main Supply</option>
        </select>

        {/* MAIN OVERRIDE */}
        <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10 flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold">One-time override</p>
            <p className="text-sm text-white/70">
              Grabbed from MAIN supply room?
            </p>
          </div>

          <button
            onClick={() => setMainOverride(!mainOverride)}
            className={`rounded-2xl px-4 py-3 ring-1 ${
              mainOverride
                ? "bg-white text-black"
                : "bg-black/40 text-white ring-white/10"
            }`}
          >
            ⚡ MAIN (1x)
          </button>
        </div>

        {/* MODE */}
        <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
          <p className="text-lg font-semibold mb-3">Mode</p>

          <div className="flex gap-3">
            <button
              onClick={() => setMode("USE")}
              className={`flex-1 rounded-2xl py-3 font-bold ${
                mode === "USE"
                  ? "bg-red-600 text-white"
                  : "bg-black/40 text-white"
              }`}
            >
              USE
            </button>

            <button
              onClick={() => setMode("RESTOCK")}
              className={`flex-1 rounded-2xl py-3 font-bold ${
                mode === "RESTOCK"
                  ? "bg-white text-black"
                  : "bg-black/40 text-white"
              }`}
            >
              RESTOCK
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mt-5 relative w-full">
          <input
            placeholder="Scan barcode or type item"
            className="w-full rounded-2xl bg-white text-black px-4 py-3 pr-14 ring-1 ring-black/10"
          />

          <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-black/10 px-3 py-2 text-black">
            📷
          </button>
        </div>

        {/* QTY */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="h-12 w-12 rounded-2xl bg-white/10 text-xl"
          >
            -
          </button>

          <div className="flex-1 rounded-2xl bg-white text-black text-center py-3 font-semibold">
            {qty}
          </div>

          <button
            onClick={() => setQty(qty + 1)}
            className="h-12 w-12 rounded-2xl bg-white/10 text-xl"
          >
            +
          </button>
        </div>

        {/* CONFIRM */}
        <button className="mt-6 w-full rounded-2xl bg-white text-black py-3 font-bold">
          Confirm {mode}
        </button>
      </div>
    </div>
  );
}
