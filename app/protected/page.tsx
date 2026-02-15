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

  // ---- Inventory totals loader ----
  async function loadTotals() {
    try {
      setListStatus("Loading inventory...");
      const res = await fetch("/api/items", { cache: "no-store" });
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
      const b = (r.barcode ?? "").toLowerCase();
      return r.item_name.toLowerCase().includes(q) || b.includes(q);
    });
  }, [rows, search]);

  // ---- Low stock detector ----
  const anyLow = useMemo(() => rows.some((r) => (r.total_on_hand ?? 0) <= 3), [rows]);

  // ---- Unlock ----
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

  // ---- Submit transaction ----
  async function handleSubmit() {
    if (!itemOrBarcode.trim()) {
      setSubmitStatus("❌ Enter item name or barcode");
      return;
    }

    const safeQty = Math.max(1, Number(qty) || 1);
    const effectiveLocation = useFromMainOneTime ? MAIN : location;

    try {
      setSubmitStatus(
        useFromMainOneTime ? `Submitting… (ONE TIME from ${MAIN})` : "Submitting…"
      );

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

      const name = data?.item?.name ?? itemOrBarcode.trim();
      const locName = data?.location?.name ?? effectiveLocation;
      const oldVal = data?.old_on_hand;
      const newVal = data?.new_on_hand;

      if (typeof oldVal === "number" && typeof newVal === "number") {
        setSubmitStatus(
          `✅ ${mode} ${safeQty} — ${name} @ ${locName} | ${oldVal} → ${newVal}`
        );
      } else {
        setSubmitStatus(`✅ ${mode} ${safeQty} — ${name} @ ${locName}`);
      }

      setItemOrBarcode("");
      setQty(1);

      // reset one-time override after successful submit
      setUseFromMainOneTime(false);

      await loadTotals();
    } catch (e: any) {
      setSubmitStatus(`❌ ${e?.message ?? "Request failed"}`);
    }
  }

  // ---- Quick action from list ----
  function quickUseOne(itemName: string) {
    setMode("USE");
    setItemOrBarcode(itemName);
    setQty(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const modePill =
    mode === "USE"
      ? "bg-red-600 text-white"
      : "bg-emerald-600 text-white";

  const statusTone =
    submitStatus.startsWith("✅")
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : submitStatus.startsWith("❌")
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live Inventory
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Baxter Health ASC – Harrison
            </h1>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Custom Inventory Control System v1.0
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Cabinet tracking + building totals + low stock alerts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTotals}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
            >
              ↻ Refresh
            </button>
            <div className={`rounded-xl px-3 py-2 text-sm font-extrabold shadow-sm ${modePill}`}>
              {mode}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Left: Controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* PIN card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black text-slate-900">
                  {isUnlocked ? "🔓 Location Unlocked" : "🔒 Location Locked"}
                </div>
                <button
                  onClick={lockNow}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50 active:scale-[0.99]"
                >
                  Lock
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-slate-400"
                />
                <button
                  onClick={handleUnlock}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800 active:scale-[0.99]"
                >
                  Unlock
                </button>
              </div>

              <div className="mt-2 text-xs font-semibold text-slate-600">
                {unlockStatus || "Unlock lets you change the default location."}
              </div>
            </div>

            {/* Location + override */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black text-slate-900">Default location</div>
                <span className="text-xs font-bold text-slate-500">(stays set)</span>
              </div>

              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!isUnlocked}
                className={`mt-3 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold outline-none ${
                  isUnlocked ? "bg-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <option>{MAIN}</option>
                <option>OR 1 - Cabinet A</option>
                <option>OR 2 - Cabinet A</option>
                <option>Pre-Op</option>
                <option>PACU</option>
              </select>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-slate-900">One-time override</div>
                    <div className="text-xs font-semibold text-slate-600">
                      If you had to grab it from Main supply while your default is a cabinet.
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setUseFromMainOneTime(true)}
                      disabled={useFromMainOneTime || mode !== "USE"}
                      className={`rounded-xl px-3 py-2 text-xs font-extrabold shadow-sm active:scale-[0.99] ${
                        useFromMainOneTime || mode !== "USE"
                          ? "bg-slate-200 text-slate-500"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                      title={mode !== "USE" ? "Override is for USE mode" : ""}
                    >
                      ⚡ MAIN (1x)
                    </button>
                    <button
                      onClick={() => setUseFromMainOneTime(false)}
                      disabled={!useFromMainOneTime}
                      className={`rounded-xl px-3 py-2 text-xs font-extrabold shadow-sm active:scale-[0.99] ${
                        !useFromMainOneTime
                          ? "bg-slate-200 text-slate-500"
                          : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {useFromMainOneTime && (
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-bold text-indigo-900">
                    ✅ Next submit pulls from <span className="underline">{MAIN}</span> only — then reverts automatically.
                  </div>
                )}
              </div>
            </div>

            {/* Mode + Inputs */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-black text-slate-900">Transaction</div>

              {/* Segmented mode */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("USE")}
                  className={`rounded-2xl px-4 py-4 text-base font-black shadow-sm active:scale-[0.99] ${
                    mode === "USE"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ⛔ USE
                </button>
                <button
                  onClick={() => {
                    setMode("RESTOCK");
                    setUseFromMainOneTime(false);
                  }}
                  className={`rounded-2xl px-4 py-4 text-base font-black shadow-sm active:scale-[0.99] ${
                    mode === "RESTOCK"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ➕ RESTOCK
                </button>
              </div>

              <label className="mt-4 block text-xs font-extrabold text-slate-600">
                Item name or barcode
              </label>
              <input
                value={itemOrBarcode}
                onChange={(e) => setItemOrBarcode(e.target.value)}
                placeholder="Type a name or barcode…"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold outline-none focus:border-slate-400"
              />

              <label className="mt-4 block text-xs font-extrabold text-slate-600">
                Quantity
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, (Number(q) || 1) - 1))}
                  className="w-14 rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-900 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                >
                  –
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  type="number"
                  min={1}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-lg font-black outline-none focus:border-slate-400"
                />
                <button
                  onClick={() => setQty((q) => Math.max(1, (Number(q) || 1) + 1))}
                  className="w-14 rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-900 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                >
                  +
                </button>
              </div>

              {/* BIG touch friendly submit */}
              <button
                onClick={handleSubmit}
                className="mt-4 w-full rounded-3xl bg-slate-900 px-6 py-6 text-xl font-black text-white shadow-lg hover:scale-[1.01] active:scale-[0.98]"
              >
                ✅ Submit {mode}
              </button>

              <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${statusTone}`}>
                {submitStatus}
              </div>
            </div>
          </div>

          {/* Right: Inventory list */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {/* Low Stock Banner */}
              {anyLow && (
                <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-900">
                  ⚠️ LOW STOCK ITEMS DETECTED — CHECK INVENTORY
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">
                    Total Inventory (All Locations)
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    Building totals (auto-summed)
                  </div>
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or barcode…"
                  className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400"
                />
              </div>

              <div className="mt-3">
                {listStatus ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    {listStatus}
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    No items found.
                  </div>
                ) : (
                  <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                    {filteredRows.map((r) => {
                      const v = Number(r.total_on_hand ?? 0);
                      const pill =
                        v <= 3
                          ? "bg-red-600"
                          : v <= 6
                          ? "bg-yellow-500"
                          : "bg-slate-900";

                      return (
                        <div
                          key={r.item_id}
                          className="flex items-center justify-between gap-4 bg-white px-4 py-3 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-900">
                              {r.item_name}
                            </div>
                            <div className="truncate text-xs font-semibold text-slate-500">
                              {r.barcode ?? ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Quick USE 1 */}
                            <button
                              onClick={() => quickUseOne(r.item_name)}
                              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.99]"
                            >
                              USE 1
                            </button>

                            {/* Colored total */}
                            <div className={`rounded-2xl px-4 py-3 text-lg font-black text-white ${pill}`}>
                              {v}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs font-semibold text-slate-500">
                Tip: keep default on your room cabinet; use ⚡ MAIN (1x) when you grab something from the supply room.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs font-semibold text-slate-500">
          Built for fast OR use • minimal mistakes • real-time stock + alerts
        </div>
      </div>
    </div>
  );
}
