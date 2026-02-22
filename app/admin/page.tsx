"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const LS_PIN = "ASC_ADMIN_PIN";
const LS_UNLOCK = "ASC_ADMIN_UNLOCKED";

type StorageInventoryRow = {
  storage_area_id: string;
  item_id: string;
  on_hand: number | null;
  par_level: number | null;
  low: boolean | null;
  low_notified: boolean | null;
  updated_at: string | null;
};

type StorageArea = {
  id: string;
  name: string | null;
  location_id: string | null;
  active: boolean | null;
};

type Item = {
  id: string;
  name: string | null;
  barcode: string | null;
  vendor: string | null;
  category: string | null;
  active: boolean | null;
};

export default function AdminInventoryPage() {
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");

  const [inv, setInv] = useState<StorageInventoryRow[]>([]);
  const [areas, setAreas] = useState<Record<string, StorageArea>>({});
  const [items, setItems] = useState<Record<string, Item>>({});

  // --- PIN handling (local only) ---
  useEffect(() => {
    const savedPin = localStorage.getItem(LS_PIN);
    const wasUnlocked = localStorage.getItem(LS_UNLOCK) === "1";

    // If no PIN set yet, default it to 1234 once (you can change in code later)
    if (!savedPin) {
      localStorage.setItem(LS_PIN, "1234");
    }

    setUnlocked(wasUnlocked);
  }, []);

  function tryUnlock() {
    const savedPin = localStorage.getItem(LS_PIN) || "1234";
    const clean = pinInput.replace(/\D/g, "").slice(0, 6);

    if (clean.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }

    if (clean !== savedPin) {
      setError("Wrong PIN.");
      return;
    }

    localStorage.setItem(LS_UNLOCK, "1");
    setUnlocked(true);
    setError(null);
  }

  function lock() {
    localStorage.setItem(LS_UNLOCK, "0");
    setUnlocked(false);
    setPinInput("");
  }

  // --- Load data (only after unlocked) ---
  useEffect(() => {
    if (!unlocked) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // pull minimal columns (fast + safe)
      const [invRes, areasRes, itemsRes] = await Promise.all([
        supabase
          .from("storage_inventory")
          .select("storage_area_id,item_id,on_hand,par_level,low,low_notified,updated_at")
          .limit(5000),
        supabase
          .from("storage_areas")
          .select("id,name,location_id,active")
          .limit(5000),
        supabase
          .from("items")
          .select("id,name,barcode,vendor,category,active")
          .limit(5000),
      ]);

      if (cancelled) return;

      if (invRes.error) return setError(invRes.error.message);
      if (areasRes.error) return setError(areasRes.error.message);
      if (itemsRes.error) return setError(itemsRes.error.message);

      const areaMap: Record<string, StorageArea> = {};
      for (const a of areasRes.data || []) areaMap[a.id] = a;

      const itemMap: Record<string, Item> = {};
      for (const i of itemsRes.data || []) itemMap[i.id] = i;

      setAreas(areaMap);
      setItems(itemMap);
      setInv(invRes.data || []);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [unlocked]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const enriched = inv.map((r) => {
      const area = areas[r.storage_area_id];
      const item = items[r.item_id];
      return {
        key: `${r.storage_area_id}::${r.item_id}`,
        areaName: area?.name || "(unknown area)",
        itemName: item?.name || "(unknown item)",
        barcode: item?.barcode || "",
        vendor: item?.vendor || "",
        category: item?.category || "",
        ...r,
      };
    });

    if (!needle) return enriched;

    return enriched.filter((r) => {
      return (
        r.areaName.toLowerCase().includes(needle) ||
        r.itemName.toLowerCase().includes(needle) ||
        r.barcode.toLowerCase().includes(needle) ||
        r.vendor.toLowerCase().includes(needle) ||
        r.category.toLowerCase().includes(needle)
      );
    });
  }, [inv, areas, items, q]);

  async function updateField(
    storage_area_id: string,
    item_id: string,
    field: "on_hand" | "par_level",
    value: number
  ) {
    const key = `${storage_area_id}::${item_id}::${field}`;
    setSavingKey(key);
    setError(null);

    const { error } = await supabase
      .from("storage_inventory")
      .update({ [field]: value })
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id);

    if (error) {
      setError(error.message);
      setSavingKey(null);
      return;
    }

    // update local state so it feels instant
    setInv((prev) =>
      prev.map((r) =>
        r.storage_area_id === storage_area_id && r.item_id === item_id
          ? { ...r, [field]: value }
          : r
      )
    );

    setSavingKey(null);
  }

  // --- UI ---
  if (!unlocked) {
    return (
      <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
          <div className="text-2xl font-extrabold">Admin Inventory</div>
          <div className="mt-2 text-white/60">
            Enter PIN to view/edit inventory like Supabase.
          </div>

          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            inputMode="numeric"
            placeholder="Enter PIN"
            className="mt-5 w-full rounded-2xl bg-white/10 ring-1 ring-white/15 px-4 py-3 text-white outline-none"
          />

          {error && <div className="mt-3 text-red-300 text-sm">{error}</div>}

          <button
            onClick={tryUnlock}
            className="mt-4 w-full rounded-2xl bg-white text-black font-semibold py-3"
          >
            Unlock
          </button>

          <Link
            href="/"
            className="mt-4 block text-center text-white/60 underline"
          >
            Back to Home
          </Link>

          <div className="mt-6 text-xs text-white/40">
            Default PIN is <span className="text-white/70">1234</span> unless you changed it earlier.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-black text-white px-4 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold">Admin Inventory (Table View)</div>
            <div className="text-white/60 text-sm">
              Edit <b>on_hand</b> and <b>par_level</b> directly.
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-2"
            >
              Home
            </Link>
            <Link
              href="/inventory"
              className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-2"
            >
              App
            </Link>
            <button
              onClick={lock}
              className="rounded-xl bg-white text-black font-semibold px-4 py-2"
            >
              Lock
            </button>
          </div>
        </div>

        <div className="mt-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search item, area, barcode, vendor…"
            className="w-full rounded-2xl bg-white/10 ring-1 ring-white/15 px-4 py-3 text-white outline-none"
          />
        </div>

        {error && <div className="mt-3 text-red-300 text-sm">{error}</div>}

        <div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          {loading ? (
            <div className="p-6 text-white/60">Loading…</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="text-left p-3">Area</th>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Barcode</th>
                    <th className="text-left p-3">On hand</th>
                    <th className="text-left p-3">Par</th>
                    <th className="text-left p-3">Low</th>
                    <th className="text-left p-3">Low Notified</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const keyOn = `${r.storage_area_id}::${r.item_id}::on_hand`;
                    const keyPar = `${r.storage_area_id}::${r.item_id}::par_level`;

                    return (
                      <tr key={r.key} className="border-t border-white/10">
                        <td className="p-3">{r.areaName}</td>
                        <td className="p-3">{r.itemName}</td>
                        <td className="p-3 text-white/60">{r.barcode}</td>

                        <td className="p-3">
                          <input
                            type="number"
                            defaultValue={r.on_hand ?? 0}
                            className="w-24 rounded-lg bg-white/10 ring-1 ring-white/15 px-2 py-1 outline-none"
                            onBlur={(e) =>
                              updateField(
                                r.storage_area_id,
                                r.item_id,
                                "on_hand",
                                Number(e.target.value || 0)
                              )
                            }
                          />
                          {savingKey === keyOn && (
                            <span className="ml-2 text-white/40">Saving…</span>
                          )}
                        </td>

                        <td className="p-3">
                          <input
                            type="number"
                            defaultValue={r.par_level ?? 0}
                            className="w-24 rounded-lg bg-white/10 ring-1 ring-white/15 px-2 py-1 outline-none"
                            onBlur={(e) =>
                              updateField(
                                r.storage_area_id,
                                r.item_id,
                                "par_level",
                                Number(e.target.value || 0)
                              )
                            }
                          />
                          {savingKey === keyPar && (
                            <span className="ml-2 text-white/40">Saving…</span>
                          )}
                        </td>

                        <td className="p-3">{r.low ? "✅" : ""}</td>
                        <td className="p-3">{r.low_notified ? "✅" : ""}</td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td className="p-6 text-white/60" colSpan={7}>
                        No results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-white/40">
          Note: This edits only <b>storage_inventory.on_hand</b> and <b>storage_inventory.par_level</b>.
        </div>
      </div>
    </main>
  );
}
