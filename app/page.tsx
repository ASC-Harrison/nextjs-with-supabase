"use client";

import { useEffect, useState } from "react";

type Area = { id: string; name: string };

export default function Page() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState("");
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Load locations
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setAreas(d.locations);
          if (d.locations.length > 0) {
            setSelected(d.locations[0].id);
          }
        }
      });
  }, []);

  const currentArea = areas.find((a) => a.id === selected)?.name ?? "—";

  function handleUnlock() {
    if (pin === "1234") {
      setLocked(false);
      setShowPin(false);
      setPin("");
    } else {
      alert("Wrong PIN");
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-6">
      {/* Header */}
      <div className="bg-white/5 rounded-3xl p-4 ring-1 ring-white/10">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-3xl font-bold">ASC</div>
            <div className="text-3xl font-bold">Inventory</div>
            <div className="text-sm text-white/60 mt-1">
              Cabinet tracking + totals
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/60">Location</div>
            <div className="font-semibold text-sm">{currentArea}</div>

            <button
              onClick={() =>
                locked ? setShowPin(true) : setLocked(true)
              }
              className="mt-2 bg-white/10 px-3 py-2 rounded-xl text-sm"
            >
              {locked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="mt-4 bg-white/5 rounded-3xl p-4 ring-1 ring-white/10">
        <div className="text-sm text-white/60 mb-1">Select location</div>

        <select
          disabled={locked}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full bg-black/40 px-3 py-2 rounded-xl ring-1 ring-white/10"
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {locked && (
          <div className="text-xs text-white/50 mt-2">
            Unlock to change location.
          </div>
        )}
      </div>

      {/* Scan Section */}
      <div className="mt-4 bg-white/5 rounded-3xl p-4 ring-1 ring-white/10">
        <div className="text-lg font-semibold mb-2">Scan Item</div>

        <input
          placeholder="Scan barcode or type item"
          className="w-full bg-white text-black px-3 py-2 rounded-xl"
        />

        <div className="flex mt-3 gap-2">
          <button className="flex-1 bg-red-600 py-2 rounded-xl font-semibold">
            USE
          </button>
          <button className="flex-1 bg-white/10 py-2 rounded-xl font-semibold">
            RESTOCK
          </button>
        </div>

        <button className="w-full mt-3 bg-black py-3 rounded-xl font-semibold">
          Submit
        </button>
      </div>

      {/* PIN Modal */}
      {showPin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#111] p-5 rounded-2xl w-full max-w-sm">
            <div className="text-lg font-semibold mb-3">
              Enter PIN
            </div>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-white text-black px-3 py-2 rounded-xl"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowPin(false)}
                className="flex-1 bg-white/10 py-2 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                className="flex-1 bg-white text-black py-2 rounded-xl"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
