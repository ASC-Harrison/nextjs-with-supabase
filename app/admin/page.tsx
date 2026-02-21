"use client";

import { useEffect, useMemo, useState } from "react";

type Area = { id: string; name: string };
type Row = {
  storage_area_id: string;
  storage_area_name: string;
  item_id: string;
  item_name: string;
  barcode: string;
  category: string;
  vendor: string;
  on_hand: number;
  par_level: number;
  low: boolean;
  low_notified: boolean;
  updated_at: string | null;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [secretOk, setSecretOk] = useState(false);

  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState<string>("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  const [savingKey, setSavingKey] = useState<string>("");

  // Load areas from your EXISTING /api/locations (so we don't touch your working code)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) return;

        const list: Area[] = json.locations || [];
        setAreas(list);
        setAreaId((prev) => prev || (list[0]?.id ?? ""));
      } catch {}
    })();
  }, []);

  async function loadInventory() {
    if (!secret) {
      setErr("Enter ADMIN_SECRET first (same value you added in Vercel).");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams();
      if (areaId) params.set("storage_area_id", areaId);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/admin/inventory?${params.toString()}`, {
        cache: "no-store",
        headers: { "x-admin-secret": secret },
      });

      const json = await res.json();
      if (!json.ok) {
        setErr(json.error || "Failed to load inventory.");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(json.rows || []);
      setSecretOk(true);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load inventory.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(row: Row, patch: Partial<Pick<Row, "on_hand" | "par_level">>) {
    if (!secret) return alert("Enter ADMIN_SECRET first.");
    const key = `${row.storage_area_id}:${row.item_id}`;
    setSavingKey(key);

    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          storage_area_id: row.storage_area_id,
          item_id: row.item_id,
          ...patch,
        }),
      });

      const json = await res.json();
      if (!json.ok) return alert(`Save failed: ${json.error}`);

      // Update row locally
      setRows((prev) =>
        prev.map((r) => {
          if (r.storage_area_id === row.storage_area_id && r.item_id === row.item_id) {
            return {
              ...r,
              on_hand: json.row.on_hand ?? r.on_hand,
              par_level: json.row.par_level ?? r.par_level,
              low: !!json.row.low,
              low_notified: !!json.row.low_notified,
              updated_at: json.row.updated_at ?? r.updated_at,
            };
          }
          return r;
        })
      );
    } finally {
      setSavingKey("");
    }
  }

  const titleArea = useMemo(() => {
    return areas.find((a) => a.id === areaId)?.name ?? "All Locations";
  }, [areas, areaId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl p-4">
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <div className="text-2xl font-extrabold">Admin Inventory</div>
              <div className="text-sm text-white/60">
                Edit on_hand / par_level like Supabase (scanner app untouched)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ADMIN_SECRET"
                className="rounded-xl bg-black/40 ring-1 ring-white/10 px-3 py-2 text-sm w-[220px]"
              />

              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="rounded-xl bg-black/40 ring-1 ring-white/10 px-3 py-2 text-sm"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (name / barcode / vendor / category)"
                className="rounded-xl bg-black/40 ring-1 ring-white/10 px-3 py-2 text-sm w-[320px]"
              />

              <button
                onClick={loadInventory}
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-bold"
              >
                {loading ? "Loading…" : "Load"}
              </button>
            </div>
          </div>

          <div className="mt-2 text-sm text-white/60">
            Showing: <span className="font-semibold text-white">{titleArea}</span>
            {secretOk ? <span className="ml-2 text-green-400">● connected</span> : null}
          </div>

          {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left">
                <th className="p-3">Item</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Category</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">On hand</th>
                <th className="p-3">Par</th>
                <th className="p-3">Low</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Save</th>
              </tr>
            </thead>
            <tbody className="bg-black">
              {rows.length === 0 ? (
                <tr>
                  <td className="p-4 text-white/60" colSpan={9}>
                    {loading ? "Loading…" : "No rows loaded yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const key = `${r.storage_area_id}:${r.item_id}`;
                  const saving = savingKey === key;

                  return (
                    <tr key={key} className="border-t border-white/10">
                      <td className="p-3">
                        <div className="font-semibold">{r.item_name}</div>
                        <div className="text-xs text-white/50">{r.storage_area_name}</div>
                      </td>

                      <td className="p-3 font-mono text-xs">{r.barcode || "—"}</td>
                      <td className="p-3">{r.category || "—"}</td>
                      <td className="p-3">{r.vendor || "—"}</td>

                      <td className="p-3">
                        <input
                          type="number"
                          min={0}
                          defaultValue={r.on_hand}
                          className="w-24 rounded-lg bg-black/40 ring-1 ring-white/10 px-2 py-1"
                          onBlur={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            if (v !== r.on_hand) saveRow(r, { on_hand: v });
                          }}
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          min={0}
                          defaultValue={r.par_level}
                          className="w-24 rounded-lg bg-black/40 ring-1 ring-white/10 px-2 py-1"
                          onBlur={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            if (v !== r.par_level) saveRow(r, { par_level: v });
                          }}
                        />
                      </td>

                      <td className="p-3">
                        <span className={r.low ? "text-red-300 font-bold" : "text-white/50"}>
                          {r.low ? "YES" : "no"}
                        </span>
                      </td>

                      <td className="p-3 text-xs text-white/50">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => saveRow(r, { on_hand: r.on_hand, par_level: r.par_level })}
                          disabled={saving}
                          className="rounded-lg bg-white/10 ring-1 ring-white/10 px-3 py-1 font-semibold disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-white/50">
          Tip: Click <b>Load</b>, then edit a number and tap/click outside the box to auto-save.
        </div>
      </div>
    </div>
  );
}
