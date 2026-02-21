"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  storage_area_id: string;
  item_id: string;
  on_hand: number;
  par_level: number;
  low: boolean;
  updated_at: string;
};

export default function InventoryEditor() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (r.item_id + " " + r.storage_area_id).toLowerCase().includes(t));
  }, [rows, q]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/inventory", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        setRows(json.rows);
      } catch (e: any) {
        alert(e?.message ?? "Failed to load inventory");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(row: Row, patch: Partial<Row>) {
    const next = { ...row, ...patch };
    setRows((prev) => prev.map((r) => (r.storage_area_id === row.storage_area_id && r.item_id === row.item_id ? next : r)));

    const res = await fetch("/api/admin/inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_area_id: row.storage_area_id,
        item_id: row.item_id,
        on_hand: next.on_hand,
        par_level: next.par_level,
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      alert(json.error);
      // reload if it fails
      location.reload();
    }
  }

  return (
    <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold">storage_inventory</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (IDs for now)…"
          className="w-full max-w-sm rounded-2xl bg-white text-black px-4 py-2"
        />
      </div>

      <div className="mt-4 text-sm text-white/60">
        Premium next step: join in item names + area names so you’re not looking at IDs.
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="text-sm text-white/70">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-white/70">No rows.</div>
        ) : (
          filtered.slice(0, 100).map((r) => (
            <div key={`${r.storage_area_id}-${r.item_id}`} className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-xs text-white/60 break-all">area_id: {r.storage_area_id}</div>
              <div className="text-xs text-white/60 break-all">item_id: {r.item_id}</div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-xs text-white/60 mb-1">on_hand</div>
                  <input
                    type="number"
                    value={r.on_hand}
                    onChange={(e) => save(r, { on_hand: Number(e.target.value) })}
                    className="w-full rounded-xl bg-white text-black px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-xs text-white/60 mb-1">par_level</div>
                  <input
                    type="number"
                    value={r.par_level}
                    onChange={(e) => save(r, { par_level: Number(e.target.value) })}
                    className="w-full rounded-xl bg-white text-black px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-3 text-xs text-white/60">
                low: <span className="text-white">{String(r.low)}</span> • updated:{" "}
                <span className="text-white">{new Date(r.updated_at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
