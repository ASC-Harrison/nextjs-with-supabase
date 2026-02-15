"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";

type TotalRow = {
  item_id: string;
  item_name: string;
  barcode: string | null;
  total_on_hand: number;
};

export default function ProtectedPage() {
  const MAIN = "Main Sterile Supply";

  // 🔥 Change this anytime you deploy to verify you're on newest build
  const BUILD_TAG = "BUILD 2026-02-14 9:15PM";

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
    return rows.filter((r) =>
      r.item_name.toLowerCase().includes(q) ||
      (r.barcode ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const anyLow = useMemo(
    () => rows.some((r) => Number(r.total_on_hand) <= 3),
    [rows]
  );

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
          <h1 className="text-3xl font-black">
            Baxter Health ASC – Harrison
          </h1>
          <div className="text-xs font-bold text-slate-400">
            {BUILD_TAG}
          </div>
        </div>

        {anyLow && (
          <div className="bg-red-100 border border-red-400 p-4 rounded-xl font-bold text-red-900">
            ⚠ LOW STOCK ITEMS DETECTED
          </div>
        )}

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
          Submit
        </button>

        <div className="text-sm font-bold">{submitStatus}</div>

        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full p-3 rounded-xl border mb-3"
          />

          {filteredRows.map((r) => (
            <div
              key={r.item_id}
              className="flex justify-between items-center p-4 bg-white rounded-xl mb-2"
            >
              <div>
                <div className="font-bold">{r.item_name}</div>
                <div className="text-xs text-gray-500">{r.barcode}</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => quickUseOne(r.item_name)}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-xl font-bold"
                >
                  USE 1
                </button>

                <div
                  className={`px-4 py-2 rounded-xl text-white font-black ${
                    Number(r.total_on_hand) <= 3
                      ? "bg-red-600"
                      : "bg-black"
                  }`}
                >
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
