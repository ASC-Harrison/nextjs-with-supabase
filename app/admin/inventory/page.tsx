"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type BuildingTotalRow = {
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  notes: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminInventoryPage() {
  const router = useRouter();

  const [rows, setRows] = useState<BuildingTotalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<BuildingTotalRow | null>(null);
  const [setVal, setSetVal] = useState("");
  const [deltaVal, setDeltaVal] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("building_inventory_sheet_view")
        .select(
          "name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit,notes"
        )
        .order("name", { ascending: true });

      if (error) throw error;
      setRows((data as BuildingTotalRow[]) ?? []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = rows;

    if (s) {
      list = list.filter((r) => {
        return (
          (r.name || "").toLowerCase().includes(s) ||
          (r.vendor || "").toLowerCase().includes(s) ||
          (r.category || "").toLowerCase().includes(s) ||
          (r.reference_number || "").toLowerCase().includes(s)
        );
      });
    }

    if (lowOnly) {
      list = list.filter((r) => {
        const onHand = r.total_on_hand ?? 0;
        const low = r.low_level ?? 0;
        return low > 0 && onHand <= low;
      });
    }

    return list;
  }, [rows, q, lowOnly]);

  const lowCount = useMemo(() => {
    return rows.filter((r) => {
      const onHand = r.total_on_hand ?? 0;
      const low = r.low_level ?? 0;
      return low > 0 && onHand <= low;
    }).length;
  }, [rows]);

  function openEdit(r: BuildingTotalRow) {
    setRow(r);
    setSetVal(String(r.total_on_hand ?? 0));
    setDeltaVal("");
    setOpen(true);
  }

  function parseIntSafe(raw: string) {
    const t = raw.trim();
    if (!t) return null;
    if (!/^-?\d+$/.test(t)) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  async function post(body: any) {
    const res = await fetch("/api/building-inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Update failed");
  }

  async function doSet() {
    if (!row) return;
    const n = parseIntSafe(setVal);
    if (n === null || n < 0) return alert("Enter a valid number (0 or more).");

    await post({ name: row.name, action: "SET", value: n });
    setOpen(false);
    await load();
  }

  async function doAdjust() {
    if (!row) return;
    const d = parseIntSafe(deltaVal);
    if (d === null || d === 0) return alert("Enter a valid delta (non-zero).");

    await post({ name: row.name, action: "ADJUST", delta: d });
    setOpen(false);
    await load();
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex justify-center">
      <div
        className="w-full max-w-md px-3 pb-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mt-3 mb-2 flex gap-2">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Home
          </button>
          <button
            onClick={() => router.push("/inventory")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← OR App
          </button>
        </div>

        <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xl font-extrabold">Admin Inventory</div>
            <div className="text-xs text-white/60">
              {loading ? "Loading…" : `${rows.length} items`}
            </div>
          </div>

          <div className="mt-2 text-xs text-white/60">
            Low items: <span className="font-semibold">{lowCount}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-2xl bg-white text-black px-4 py-3"
            />
            <button
              onClick={() => setLowOnly((v) => !v)}
              className={[
                "rounded-2xl px-4 py-3 font-extrabold ring-1 text-sm",
                lowOnly
                  ? "bg-red-600 text-white ring-red-500/30"
                  : "bg-white/10 text-white ring-white/10",
              ].join(" ")}
            >
              {lowOnly ? "LOW ONLY" : "ALL"}
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              onClick={load}
              className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/10"
            >
              Refresh
            </button>
          </div>

          {err && (
            <div className="mt-2 text-sm text-red-300 break-words">{err}</div>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {filtered.slice(0, 250).map((r) => {
            const onHand = r.total_on_hand ?? 0;
            const low = r.low_level ?? 0;
            const isLow = low > 0 && onHand <= low;

            return (
              <button
                key={r.name}
                onClick={() => openEdit(r)}
                className="w-full text-left rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold break-words">
                      {r.name}
                    </div>
                    <div className="mt-1 text-xs text-white/60 break-words">
                      {r.vendor ?? "—"} • {r.category ?? "—"}{" "}
                      {r.reference_number ? `• ${r.reference_number}` : ""}
                    </div>
                  </div>

                  <div
                    className={[
                      "shrink-0 rounded-2xl px-3 py-2 text-sm font-extrabold ring-1",
                      isLow
                        ? "bg-red-600 text-white ring-red-500/30"
                        : "bg-white/10 text-white ring-white/10",
                    ].join(" ")}
                  >
                    {onHand}
                    <div className="text-[10px] font-semibold opacity-80">
                      on hand
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-black/30 p-2 ring-1 ring-white/10">
                    <div className="text-white/60">Par</div>
                    <div className="font-semibold">{r.par_level ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2 ring-1 ring-white/10">
                    <div className="text-white/60">Low</div>
                    <div className="font-semibold">{r.low_level ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2 ring-1 ring-white/10">
                    <div className="text-white/60">Unit</div>
                    <div className="font-semibold">{r.unit ?? "—"}</div>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-white/50">Tap to edit</div>
              </button>
            );
          })}
        </div>

        {open && row && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
              <div className="text-lg font-semibold">Edit on-hand</div>
              <div className="mt-1 text-sm font-semibold break-words">
                {row.name}
              </div>

              <div className="mt-4 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold">Set exact on-hand</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={setVal}
                    onChange={(e) =>
                      setSetVal(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
                    placeholder="e.g., 17"
                  />
                  <button
                    onClick={() => doSet().catch((e) => alert(e.message))}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
                  >
                    Set
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold">Adjust + / −</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={deltaVal}
                    onChange={(e) =>
                      setDeltaVal(
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 7)
                      )
                    }
                    inputMode="numeric"
                    className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
                    placeholder="e.g., +5 or -2"
                  />
                  <button
                    onClick={() => doAdjust().catch((e) => alert(e.message))}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold ring-1 ring-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-[11px] text-white/50">
          Showing up to 250 rows to keep it fast.
        </div>
      </div>
    </div>
  );
}
