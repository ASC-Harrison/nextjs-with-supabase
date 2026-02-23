"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/**
 * ADMIN TABLE VIEW (Elite UI)
 * - Reads: storage_inventory + joined storage_areas + items
 * - Edits ONLY: storage_inventory.on_hand, storage_inventory.par_level
 * - PIN gate is localStorage-based
 *
 * ✅ NO LIMIT (loads all rows)
 * ✅ Desktop elite table
 * ✅ Mobile now looks like desktop: same table, horizontal scroll
 */

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
      ? "bg-amber-500/12 text-amber-100 ring-amber-300/25"
      : tone === "bad"
      ? "bg-rose-500/12 text-rose-200 ring-rose-300/25"
      : "bg-white/5 text-white/75 ring-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm font-extrabold transition",
        "ring-1 ring-white/10 bg-white/5 hover:bg-white/10",
        active && "bg-white text-black ring-white/40 hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-500/8 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/8 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/8 ring-rose-400/20"
      : "bg-white/5 ring-white/10";

  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-2 ring-1",
        "shadow-[0_12px_40px_rgba(0,0,0,0.25)]",
        toneCls
      )}
    >
      <div className="text-[10px] tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-white/90 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [locked, setLocked] = useState(true);
  const [pinEntry, setPinEntry] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    try {
      const unlocked = localStorage.getItem(LS_UNLOCK) === "true";
      setLocked(!unlocked);
    } catch {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchRows() {
    setLoading(true);
    setToast(null);

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
      .order("updated_at", { ascending: false }); // ✅ NO LIMIT

    if (error) {
      setToast(`Load failed: ${error.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as Row[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPinAndUnlock() {
    const stored = localStorage.getItem(LS_PIN) || "";
    if (!stored) {
      setToast("No admin PIN set yet. Set it first in your PIN settings flow.");
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
    return rows.filter((r) => {
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
      {/* Elite background */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-80 w-[980px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.25em] text-white/45">
                BAXTER ASC • ADMIN CONSOLE
              </div>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight">
                Admin Inventory <span className="text-white/55">(Table View)</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Edit <span className="font-semibold text-white/85">on_hand</span> and{" "}
                <span className="font-semibold text-white/85">par_level</span> directly. Saves when you tap out.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                <Link
                  href="/"
                  className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
                >
                  Home
                </Link>
                <Link
                  href="/inventory"
                  className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
                >
                  App
                </Link>
                <IconButton onClick={lockNow} active={locked === true}>
                  {locked ? "🔒 Locked" : "Lock"}
                </IconButton>
              </div>

              <div className="grid grid-cols-4 gap-2 w-full md:w-auto">
                <StatChip label="STATE" value={locked ? "LOCKED" : "OPEN"} tone={locked ? "bad" : "good"} />
                <StatChip label="ROWS" value={stats.total} />
                <StatChip label="LOW" value={stats.low} tone={stats.low ? "warn" : "neutral"} />
                <StatChip label="NOTIFIED" value={stats.notified} tone={stats.notified ? "warn" : "neutral"} />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-xl">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search item, area, barcode, vendor, category…"
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyLow((v) => !v)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition",
                  onlyLow
                    ? "bg-amber-400/20 text-amber-100 ring-amber-300/30"
                    : "bg-white/5 text-white/80 ring-white/10 hover:bg-white/10"
                )}
              >
                {onlyLow ? "Showing: LOW" : "Filter: LOW only"}
              </button>

              <button
                type="button"
                onClick={fetchRows}
                className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <input
                inputMode="numeric"
                value={pinEntry}
                onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter admin PIN"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30 md:w-48"
              />
              <button
                type="button"
                onClick={openPinAndUnlock}
                className="whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* ✅ One table for ALL sizes (desktop look everywhere) */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ring-1 ring-white/5">
          {/* Horizontal scroll shell for mobile */}
          <div className="overflow-x-auto">
            {/* Make sure table doesn't squish on mobile */}
            <div className="min-w-[980px]">
              {/* Header row (sticky inside scroll area) */}
              <div className="sticky top-0 z-10 grid grid-cols-12 gap-0 border-b border-white/10 bg-black/60 px-4 py-3 text-xs font-semibold tracking-wider text-white/55">
                <div className="col-span-3">AREA</div>
                <div className="col-span-4">ITEM</div>
                <div className="col-span-2">BARCODE</div>
                <div className="col-span-1 text-center">ON HAND</div>
                <div className="col-span-1 text-center">PAR</div>
                <div className="col-span-1 text-right">STATUS</div>
              </div>

              {loading ? (
                <div className="p-6 text-white/60">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-white/60">No results.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filtered.map((r) => {
                    const areaName = r.storage_areas?.name || "(unknown area)";
                    const itemName = r.items?.name || "(unknown item)";
                    const barcode = r.items?.barcode || "";
                    const statusTone = r.low ? "warn" : "good";

                    const onHandKey = `${r.storage_area_id}:${r.item_id}:on_hand`;
                    const parKey = `${r.storage_area_id}:${r.item_id}:par_level`;

                    return (
                      <div
                        key={`${r.storage_area_id}:${r.item_id}`}
                        className={cn(
                          "grid grid-cols-12 items-center gap-0 px-4 py-3 transition",
                          r.low
                            ? "bg-amber-500/8 hover:bg-amber-500/14"
                            : "hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="col-span-3">
                          <div className="text-sm font-extrabold text-white/90">{areaName}</div>
                          <div className="mt-0.5 text-xs text-white/45">
                            {r.items?.vendor ? r.items.vendor : r.items?.category ? r.items.category : ""}
                          </div>
                        </div>

                        <div className="col-span-4 min-w-0">
                          <div className="text-sm font-extrabold truncate">{itemName}</div>
                          <div className="mt-0.5 text-xs text-white/45">
                            {r.items?.category ? `Category: ${r.items.category}` : ""}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <div className="text-sm text-white/80 break-all">{barcode || "—"}</div>
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <input
                            disabled={locked}
                            defaultValue={String(r.on_hand ?? 0)}
                            onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                            className={cn(
                              "w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums",
                              "ring-1 ring-white/10 outline-none focus:ring-white/30",
                              "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
                              locked && "opacity-60"
                            )}
                          />
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <input
                            disabled={locked}
                            defaultValue={String(r.par_level ?? 0)}
                            onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                            className={cn(
                              "w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums",
                              "ring-1 ring-white/10 outline-none focus:ring-white/30",
                              "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
                              locked && "opacity-60"
                            )}
                          />
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <div className="flex items-center gap-2">
                            {(savingKey === onHandKey || savingKey === parKey) && (
                              <Pill tone="neutral">Saving…</Pill>
                            )}
                            <Pill tone={statusTone as any}>{r.low ? "LOW" : "OK"}</Pill>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-white/45">
          Tip: On mobile, swipe sideways to see all columns. (This keeps the true desktop look.)
        </div>

        <div className="mt-1 text-xs text-white/45">
          Note: This edits only{" "}
          <span className="font-semibold text-white/70">storage_inventory.on_hand</span> and{" "}
          <span className="font-semibold text-white/70">storage_inventory.par_level</span>.
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-black/80 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-xl">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
