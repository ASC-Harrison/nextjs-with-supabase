"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const LS_PIN = "ASC_ADMIN_PIN";
const LS_UNLOCK = "ASC_ADMIN_UNLOCKED";

type Row = {
  storage_area_id: string;
  item_id: string;
  on_hand: number | null;
  par_level: number | null;
  low?: boolean | null;
  low_notified?: boolean | null;
  updated_at?: string | null;
  storage_areas?: { name?: string | null } | null;
  items?: {
    name?: string | null;
    barcode?: string | null;
    vendor?: string | null;
    category?: string | null;
  } | null;
};

export default function AdminPage() {
  const [locked, setLocked] = useState(true);
  const [pinEntry, setPinEntry] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // Load unlock state
  useEffect(() => {
    const unlocked = localStorage.getItem(LS_UNLOCK) === "true";
    setLocked(!unlocked);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // 🔥 NO LIMIT VERSION
  async function fetchRows() {
    setLoading(true);

    const { data, error } = await supabase
      .from("storage_inventory")
      .select(`
        storage_area_id,
        item_id,
        on_hand,
        par_level,
        low,
        low_notified,
        updated_at,
        storage_areas ( name ),
        items ( name, barcode, vendor, category )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      setToast(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function unlock() {
    const stored = localStorage.getItem(LS_PIN) || "";
    if (!stored) {
      setToast("No admin PIN set yet.");
      return;
    }
    if (pinEntry === stored) {
      localStorage.setItem(LS_UNLOCK, "true");
      setLocked(false);
      setPinEntry("");
      setToast("Unlocked");
    } else {
      setToast("Wrong PIN");
    }
  }

  function lockNow() {
    localStorage.setItem(LS_UNLOCK, "false");
    setLocked(true);
  }

  async function saveCell(r: Row, field: "on_hand" | "par_level", value: string) {
    if (locked) return;

    const num = value === "" ? null : Number(value);

    const { error } = await supabase
      .from("storage_inventory")
      .update({ [field]: num })
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);

    if (!error) {
      setRows(prev =>
        prev.map(x =>
          x.storage_area_id === r.storage_area_id &&
          x.item_id === r.item_id
            ? { ...x, [field]: num }
            : x
        )
      );
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (onlyLow && !r.low) return false;
      if (!q) return true;

      const needle = q.toLowerCase();
      return (
        r.storage_areas?.name?.toLowerCase().includes(needle) ||
        r.items?.name?.toLowerCase().includes(needle) ||
        r.items?.barcode?.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, onlyLow]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-4">
        Admin Inventory (Table View)
      </h1>

      <div className="flex gap-2 mb-4">
        <Link href="/">Home</Link>
        <Link href="/inventory">App</Link>
        <button onClick={lockNow}>{locked ? "Locked" : "Lock"}</button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          placeholder="Search..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="text-black px-2 py-1"
        />
        <button onClick={() => setOnlyLow(v => !v)}>
          {onlyLow ? "Showing LOW" : "Filter LOW"}
        </button>
        <button onClick={fetchRows}>Refresh</button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={pinEntry}
          onChange={e => setPinEntry(e.target.value)}
          placeholder="Enter admin PIN"
          className="text-black px-2 py-1"
        />
        <button onClick={unlock}>Unlock</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          {filtered.map(r => (
            <div
              key={`${r.storage_area_id}-${r.item_id}`}
              className="border-b border-white/20 py-3"
            >
              <div className="font-semibold">
                {r.storage_areas?.name}
              </div>

              <div>{r.items?.name}</div>

              <div>Barcode: {r.items?.barcode || "-"}</div>

              <div className="flex gap-4 mt-2">
                <input
                  disabled={locked}
                  defaultValue={r.on_hand ?? ""}
                  onBlur={e =>
                    saveCell(r, "on_hand", e.target.value)
                  }
                  className="text-black px-2 py-1 w-24"
                />
                <input
                  disabled={locked}
                  defaultValue={r.par_level ?? ""}
                  onBlur={e =>
                    saveCell(r, "par_level", e.target.value)
                  }
                  className="text-black px-2 py-1 w-24"
                />
              </div>

              <div className="mt-1">
                Status: {r.low ? "LOW" : "OK"}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="mt-4">{toast}</div>}
    </div>
  );
}
