"use client";

import { useEffect, useMemo, useState } from "react";

type TotalRow = {
  item_id: string;
  item_name: string;
  barcode: string | null;
  total_on_hand: number;
};

export default function ProtectedPage() {
  const MAIN = "Main Sterile Supply";

  // Change this anytime to prove you're on the latest build
  const BUILD_TAG = "BUILD 2026-02-14 9:25PM";

  const [location, setLocation] = useState(MAIN);
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [itemOrBarcode, setItemOrBarcode] = useState("");
  const [qty, setQty] = useState<number>(1);

  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState("");

  const [useFromMainOneTime, setUseFromMainOneTime] = useState(false);

  const [submitStatus, setSubmitStatus] = useState<string>("Ready");
  const [rows, setRows] = useState<TotalRow[]>([]);
  const [listStatus, setListStatus] = useState<string>("Loading inventory...");
  const [search, setSearch] = useState("");

  // ---- Lock persistence ----
  useEffect(() => {
    const until = Number(localStorage.getItem("unlockedUntil") || "0");
    setIsUnlocked(Date.now() < until);
  }, []);

  function lockNow() {
    localStorage.removeItem("unlockedUntil");
    setIsUnlocked(false);
    setUnlockStatus("🔒 Locked");
  }

  // ---- Load totals ----
  async function loadTotals() {
    try {
      setListStatus("Loading inventory...");
      const res = await fetch("/api/items?ts=" + Date.now(), {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setRows([]);
        setListStatus(`❌ ${data?.error ?? `Failed (${res.status})`}`);
        return;
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setListStatus("");
    } catch (e: any) {
      setRows([]);
      setListStatus(`❌ ${e?.message ?? "Failed to load inventory"}`);
    }
  }

  useEffect(() => {
    loadTotals();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.item_name.toLowerCase();
      const bc = (r.barcode ?? "").toLowerCase();
      return name.includes(q) || bc.includes(q);
    });
  }, [rows, search]);

  async function handleUnlock() {
    try {
      setUnlockStatus("Unlocking...");
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setUnlockStatus(`❌ ${data?.error ?? "Invalid PIN"}`);
        return;
      }

      const until = Date.now() + 30 * 60 * 1000;
      localStorage.setItem("unlockedUntil", String(until));
      setIsUnlocked(true);
      setPin("");
      setUnlockStatus("✅ Unlocked (30 min)");
    } catch (e: any) {
      setUnlockStatus(`❌ ${e?.message ?? "Unlock failed"}`);
    }
  }

  async function handleSubmit() {
    if (!itemOrBarcode.trim()) {
      setSubmitStatus("❌ Enter item name or barcode");
      return;
    }

    const safeQty = Math.max(1, Number(qty) || 1);
    const effectiveLocation = useFromMainOneTime ? MAIN : location;

    try {
      setSubmitStatus("Submitting…");

      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: effectiveLocation,
          mode,
          itemOrBarcode: itemOrBarcode.trim(),
          qty: safeQty,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setSubmitStatus(`❌ ${data?.error ?? `Failed (${res.status})`}`);
        return;
      }

      setSubmitStatus("✅ Success");
      setItemOrBarcode("");
      setQty(1);
      setUseFromMainOneTime(false);
      await loadTotals();
    } catch (e: any) {
      setSubmitStatus(`❌ ${e?.message ?? "Request failed"}`);
    }
  }

  function quickUseOne(name: string) {
    setMode("USE");
    setItemOrBarcode(name);
    setQty(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black">Baxter ASC Inventory</h1>
          <div className="text-xs font-bold text-slate-400">{BUILD_TAG}</div>
        </div>

        {/* Lock / Location */}
        <div className="bg-white border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold">
              {isUnlocked ? "🔓 Location Unlocked" : "🔒 Location Locked"}
            </div>

            {isUnlocked ? (
              <button
                onClick={lockNow}
                className="px-4 py-2 rounded-xl bg-slate-200 font-bold"
              >
                Lock
              </button>
            ) : (
              <button
                onClick={handleUnlock}
                className="px-4 py-2 rounded-xl bg-black text-white font-bold"
              >
                Unlock
              </button>
            )}
          </div>

          {!isUnlocked && (
            <div className="space-y-2">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full p-3 rounded-xl border"
              />
              <div className="text-sm font-bold">{unlockStatus}</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="font-bold">Default location</div>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!isUnlocked}
              className="w-full p-3 rounded-xl border bg-white disabled:bg-slate-100"
            >
              <option>Main Sterile Supply</option>
              <option>OR 1 - Cabinet A</option>
              <option>OR 1 - Cabinet B</option>
              <option>OR 2 - Cabinet A</option>
              <option>OR 2 - Cabinet B</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseFromMainOneTime(true)}
              className={`px-4 py-2 rounded-xl font-bold ${
                useFromMainOneTime ? "bg-blue-600 text-white" : "bg-slate-200"
              }`}
            >
              ⚡ MAIN (1x)
            </button>

            {useFromMainOneTime && (
              <button
                onClick={() => setUseFromMainOneTime(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 font-bold"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Mode Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("USE")}
            className={`p-6 rounded-xl font-black text-white ${
              mode === "USE" ? "bg-red-600" : "bg-slate-400"
            }`}
          >
            USE
          </button>

          <button
            onClick={() => setMode("RESTOCK")}
            className={`p-6 rounded-xl font-black text-white ${
              mode === "RESTOCK" ? "bg-green-600" : "bg-slate-400"
            }`}
          >
            RESTOCK
          </button>
        </div>

        {/* Transaction Form */}
        <div className="bg-white border rounded-2xl p-4 space-y-3">
          <input
            value={itemOrBarcode}
            onChange={(e) => setItemOrBarcode(e.target.value)}
            placeholder="Item name or barcode"
            className="w-full p-4 rounded-xl border"
          />

          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full p-4 rounded-xl border"
          />

          <button
            onClick={handleSubmit}
            className="w-full p-6 bg-black text-white rounded-xl font-black text-xl"
          >
            Submit {mode}
          </button>

          <div className="text-sm font-bold">{submitStatus}</div>
        </div>

        {/* Total Inventory */}
        <div className="bg-white border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-black text-lg">Total Inventory (All Locations)</div>
            <button
              onClick={loadTotals}
              className="px-4 py-2 rounded-xl bg-slate-200 font-bold"
            >
              Refresh
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or barcode..."
            className="w-full p-3 rounded-xl border"
          />

          {listStatus && <div className="text-sm font-bold">{listStatus}</div>}

          {filteredRows.map((r) => (
            <div
              key={r.item_id}
              className="flex justify-between items-center p-4 bg-slate-50 rounded-xl"
            >
              <div>
                <div className="font-bold">{r.item_name}</div>
                <div className="text-xs text-gray-500">{r.barcode ?? ""}</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => quickUseOne(r.item_name)}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-xl font-bold"
                >
                  USE 1
                </button>

                <div className="px-4 py-2 rounded-xl bg-black text-white font-black">
                  {r.total_on_hand}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
