"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const LS_PIN = "ASC_ADMIN_PIN";          // your saved admin PIN
const LS_UNLOCK = "ASC_ADMIN_UNLOCKED";  // "true" when unlocked

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/10 text-rose-200 ring-rose-400/20"
      : "bg-white/5 text-white/70 ring-white/10";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1", toneCls)}>
      {children}
    </span>
  );
}

export default function AdminPage() {
  const [locked, setLocked] = useState(true);
  const [pinEntry, setPinEntry] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // Load lock state (per-device)
  useEffect(() => {
    try {
      const unlocked = localStorage.getItem(LS_UNLOCK) === "true";
      setLocked(!unlocked);
    } catch {
      setLocked(true);
    }
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchRows() {
    setLoading(true);
    setToast(null);

    // ✅ Load MORE than 200 rows (Supabase uses range for paging)
    // Keep this reasonable so the phone doesn't melt.
    const from = 0;
    const to = 4999; // 5000 rows max per refresh

    const { data, error } = await supabase
      .from("storage_inventory")
      .select(
        `
        storage_area_id,
        item_id,
        on_hand,
        par_level,
        low,
        low_notified,
        updated_at,
        storage_areas:storage_area_id ( name ),
        items:item_id ( name, barcode, vendor, category )
      `
      )
      .range(from, to);

    if (error) {
      setToast(`Load failed: ${error.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as Row[]) || []);
    setLoading(false);
    setToast(`Loaded ${(data as any[])?.length ?? 0} rows ✅`);
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlockNow() {
    const stored = localStorage.getItem(LS_PIN) || "";
    if (!stored) {
      setToast("No admin PIN set yet. Set it first (I’ll add this next).");
      return;
    }
    if (pinEntry.trim() === stored.trim()) {
      localStorage.setItem(LS_UNLOCK, "true");
      setLocked(false);
      setPinEntry("");
      setToast("Unlocked ✅");
    } else {
      setToast("Wrong PIN");
    }
  }

  function lockNow() {
    localStorage.setItem(LS_UNLOCK, "false");
    setLocked(true);
    setToast("Locked 🔒");
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyLow && !r.low) return false;
        if (!needle) return true;

        const area = (r.storage_areas?.name || "").toLowerCase();
        const name = (r.items?.name || "").toLowerCase();
        const barcode = (r.items?.barcode || "").toLowerCase();
        const vendor = (r.items?.vendor || "").toLowerCase();
        const cat = (r.items?.category || "").toLowerCase();

        return (
          area.includes(needle) ||
          name.includes(needle) ||
          barcode.includes(needle) ||
          vendor.includes(needle) ||
          cat.includes(needle)
        );
      })
      // ✅ Sort so you actually SEE every area instead of "latest updated"
      .sort((a, b) => {
        const an = (a.storage_areas?.name || "").localeCompare(b.storage_areas?.name || "");
        if (an !== 0) return an;
        return (a.items?.name || "").localeCompare(b.items?.name || "");
      });
  }, [rows, q, onlyLow]);

  const stats = useMemo(() => {
    const total = rows.length;
    const low = rows.filter((r) => r.low).length;
    const notified = rows.filter((r) => r.low_notified).length;
    return { total, low, notified };
  }, [rows]);

  async function saveCell(r: Row, field: "on_hand" | "par_level", value: string) {
    if (locked) {
      setToast("PIN required");
      return;
    }

    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      setToast("Enter a valid number");
      return;
    }

    const key = `${r.storage_area_id}:${r.item_id}:${field}`;
    setSavingKey(key);

    const patch: Partial<Row> = { [field]: num } as any;

    const { error } = await supabase
      .from("storage_inventory")
      .update(patch)
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      setSavingKey(null);
      return;
    }

    setRows((prev) =>
      prev.map((x) =>
        x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
          ? { ...x, ...patch }
          : x
      )
    );

    setSavingKey(null);
    setToast("Saved ✅");
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-xs tracking-widest text-white/50">BAXTER ASC</div>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight">
                Admin Inventory <span className="text-white/60">(Table View)</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                View everything. Edit <span className="font-semibold text-white/80">on_hand</span> and{" "}
                <span className="font-semibold text-white/80">par_level</span> when unlocked.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                <Link
                  href="/"
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
                >
                  Home
                </Link>
                <Link
                  href="/inventory"
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
                >
                  App
                </Link>
                <button
                  onClick={lockNow}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition",
                    locked ? "bg-white/10 ring-white/20" : "bg-white text-black ring-white/40"
                  )}
                >
                  {locked ? "Locked" : "Lock"}
                </button>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
                <Pill tone={locked ? "bad" : "good"}>{locked ? "PIN Required" : "Unlocked"}</Pill>
                <Pill>{stats.total} rows</Pill>
                <Pill tone={stats.low ? "warn" : "neutral"}>{stats.low} low</Pill>
                <Pill tone={stats.notified ? "warn" : "neutral"}>{stats.notified} notified</Pill>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search item, area, barcode, vendor, category…"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30 md:max-w-xl"
              />

              <button
                type="button"
                onClick={() => setOnlyLow((v) => !v)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition",
                  onlyLow
                    ? "bg-amber-400/20 text-amber-100 ring-amber-300/30"
                    : "bg-white/5 text-white/80 ring-white/10 hover:bg-white/10"
                )}
              >
                {onlyLow ? "Showing: LOW only" : "Filter: LOW only"}
              </button>

              <button
                type="button"
                onClick={fetchRows}
                className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
              >
                Refresh (up to 5000)
              </button>
            </div>

            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <input
                inputMode="numeric"
                value={pinEntry}
                onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter admin PIN"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30 md:w-56"
              />
              <button
                type="button"
                onClick={unlockNow}
                className="whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile cards only (simple + reliable) */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-white/60">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-white/60">
            No results. (Try turning OFF “LOW only”, clear search, then Refresh.)
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const areaName = r.storage_areas?.name || "(unknown area)";
              const itemName = r.items?.name || "(unknown item)";
              const barcode = r.items?.barcode || "—";

              return (
                <div
                  key={`${r.storage_area_id}:${r.item_id}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 ring-1 ring-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs tracking-widest text-white/45">AREA</div>
                      <div className="text-lg font-extrabold">{areaName}</div>

                      <div className="mt-3 text-xs tracking-widest text-white/45">ITEM</div>
                      <div className="text-base font-bold">{itemName}</div>

                      <div className="mt-1 text-xs text-white/50 break-all">Barcode: {barcode}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Pill tone={r.low ? "warn" : "good"}>{r.low ? "LOW" : "OK"}</Pill>
                      {r.low_notified ? <Pill tone="warn">Notified</Pill> : <Pill>—</Pill>}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="text-xs font-semibold text-white/50">ON HAND</div>

                      {locked ? (
                        <div className="mt-2 rounded-xl bg-black/30 px-3 py-4 text-center text-2xl font-extrabold ring-1 ring-white/10">
                          {r.on_hand ?? 0}
                        </div>
                      ) : (
                        <input
                          defaultValue={r.on_hand ?? ""}
                          onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                          className="mt-2 w-full rounded-xl bg-white/5 px-3 py-3 text-center text-2xl font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                        />
                      )}
                    </div>

                    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="text-xs font-semibold text-white/50">PAR</div>

                      {locked ? (
                        <div className="mt-2 rounded-xl bg-black/30 px-3 py-4 text-center text-2xl font-extrabold ring-1 ring-white/10">
                          {r.par_level ?? 0}
                        </div>
                      ) : (
                        <input
                          defaultValue={r.par_level ?? ""}
                          onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                          className="mt-2 w-full rounded-xl bg-white/5 px-3 py-3 text-center text-2xl font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                        />
                      )}
                    </div>
                  </div>

                  {!locked && (
                    <div className="mt-3 text-xs text-white/45">
                      Saves when you tap out of the field.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-white/45">
          Note: This edits only <span className="font-semibold text-white/70">storage_inventory.on_hand</span> and{" "}
          <span className="font-semibold text-white/70">storage_inventory.par_level</span>.
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-black/80 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15">
          {toast}
        </div>
      )}
    </div>
  );
}
