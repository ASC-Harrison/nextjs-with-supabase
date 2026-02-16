"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function ProtectedPage() {
  const [currentLocation, setCurrentLocation] = useState("Main Sterile Supply");

  return (
    <div className="min-h-screen bg-[#303136] text-white">

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">

        {/* Logo */}
        <div className="flex items-center gap-4">
          <Image
            src="/asc-header-logo.png"
            alt="Ambulatory Surgery Center"
            width={280}
            height={80}
            priority
          />
        </div>

        {/* Current Location Badge */}
        <div className="text-sm bg-white/10 px-4 py-2 rounded-xl">
          Location: <span className="font-semibold">{currentLocation}</span>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="p-6 space-y-6">

        {/* Transaction Card */}
        <div className="bg-white text-black rounded-2xl p-6 shadow-lg max-w-xl mx-auto">

          <h2 className="text-xl font-semibold mb-4">Transaction</h2>

          {/* USE / RESTOCK Buttons */}
          <div className="flex gap-4 mb-4">
            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition">
              USE
            </button>

            <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition">
              RESTOCK
            </button>
          </div>

          {/* Item Input */}
          <input
            type="text"
            placeholder="Item name or barcode"
            className="w-full border rounded-xl px-4 py-3 mb-4"
          />

          {/* Quantity */}
          <input
            type="number"
            defaultValue={1}
            className="w-full border rounded-xl px-4 py-3 mb-4"
          />

          {/* Submit */}
          <button className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">
            Submit
          </button>
        </div>

      </div>
    </div>
  );
}
