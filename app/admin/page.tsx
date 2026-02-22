"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/**
 * ADMIN TABLE VIEW (Elite UI)
 * - Reads: storage_inventory joined to storage_areas + items
 * - Edits ONLY: storage_inventory.on_hand, storage_inventory.par_level
 *
 * FIXES INCLUDED:
 * ✅ Admin PIN can be SET right on this page (works on phone too)
 * ✅ Unlock works per-device (localStorage) — expected behavior
 * ✅ on_hand displays even when null (shows 0 instead of blank)
 * ✅ Pagination "Load more" so you can see beyond 200 rows
 * ✅ "LOW only" filter toggle works correctly
 */

const LS_PIN = "ASC_ADMIN_PIN"; // saved admin PIN (per device)
const LS_UNLOCK = "ASC_ADMIN_UNLOCKED"; // "true" when unlocked (per device)

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
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "ring-1 ring-white/10 bg-white/5 hover:bg-white/10",
        active && "bg-white text-black ring-white/40 hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

export default function AdminPage() {
  const [locked, setLocked] = useState(true);
  const [pinEntry, setPinEntry] = useState("");
  const [pinSetValue, setPinSetValue] = useState(""); // for setting pin
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // Pagination
  const PAGE_SIZE = 200;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Load lock state on this device
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

  function getStoredPin() {
    try {
      return localStorage.getItem(LS_PIN) || "";
    } catch {
      return "";
    }
  }

  function saveAdminPin() {
    const cleaned = pinSetValue.replace(/\D/g, "").slice(0, 8);
    if (cleaned.length < 4) {
      setToast("PIN must be at least 4 digits");
      return;
    }
    try {
      localStorage.setItem(LS_PIN, cleaned);
      setPinSetValue("");
      setToast("Admin PIN saved ✅");
    } catch {
      setToast("Could not save PIN on this device");
    }
  }

  function unlockNow() {
    const stored = getStoredPin();
    if (!stored) {
      setToast("No admin PIN set yet. Set it below first.");
      return;
    }
    if (pinEntry.trim() === stored.trim()) {
      try {
        localStorage.setItem(LS_UNLOCK, "true");
      } catch {}
      setLocked(false);
      setPinEntry("");
      setToast("Unlocked ✅");
    } else {
      setToast("Wrong PIN");
    }
  }

  function lockNow() {
    try {
      localStorage.setItem(LS_UNLOCK, "false");
    } catch {}
    setLocked(true);
    setToast("Locked 🔒");
  }

  async function fetchRows(reset = true) {
    if (reset) {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    setToast(null);

    const from = reset ? 0 : (page + 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

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
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) {
      setToast(`Load failed: ${error.message}`);
      if (reset) setRows([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const next = ((data as Row[]) || []).map((r) => ({
      ...r,
      // make sure null doesn't look blank everywhere
      on_hand: r.on_hand ?? 0,
      par_level: r.par_level ?? 0,
    }));

    if (reset) {
      setRows(next);
      setPage(0);
    } else {
      setRows((prev) => [...prev, ...next]);
      setPage((p) => p + 1);
    }

    // If we got less than PAGE_SIZE, we're done
    setHasMore(next.length === PAGE_SIZE);

    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    fetchRows(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const num = value === "" ? 0 : Number(value);
    if (!Number.isFinite(num) || num < 0) {
      setToast("Enter a valid number");
      return;
    }

    const patch: Partial<Row> = { [field]: num } as any;

    const { error } = await supabase
      .from("storage_inventory")
      .update(patch)
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      return;
    }

    setRows((prev) =>
      prev.map((x) =>
        x.storage_area_id === r.storage_area_id && x.item_id === r.item_id ? { ...x, ...patch } : x
      )
    );

    setToast("Saved ✅");
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Subtle elite background */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-72 w-[900px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-40 left-10 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Sticky elite header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-xs tracking-widest text-white/50">BAXTER ASC</div>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight">
                Admin Inventory <span className="text-white/60">(Table View)</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Edit <span className="font-semibold text-white/80">on_hand</span> and{" "}
                <span className="font-semibold text-white/80">par_level</span> directly.
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
                <IconButton onClick={lockNow} active={locked === true}>
                  {locked ? "Locked" : "Lock"}
                </IconButton>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
                <Pill tone={locked ? "bad" : "good"}>{locked ? "PIN Required" : "Unlocked"}</Pill>
                <Pill tone="neutral">{stats.total} rows</Pill>
                <Pill tone={stats.low ? "warn" : "neutral"}>{stats.low} low</Pill>
                <Pill tone={stats.notified ? "warn" : "neutral"}>{stats.notified} notified</Pill>
              </div>
            </div>
          </div>

          {/* Search + filters + refresh */}
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
                onClick={() => fetchRows(true)}
                className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            {/* Unlock */}
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
                onClick={unlockNow}
                className="whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
              >
                Unlock
              </button>
            </div>
          </div>

          {/* ✅ PIN SETTER (fixes phone saying no pin set) */}
          {!getStoredPin() && (
            <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
              <div className="text-sm font-semibold">Set Admin PIN (this device)</div>
              <div className="mt-1 text-xs text-white/60">
                This PIN is stored on the device (phone/tablet/PC). Set it once per device.
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  inputMode="numeric"
                  value={pinSetValue}
                  onChange={(e) => setPinSetValue(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="New admin PIN (4+ digits)"
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30"
                />
                <button
                  type="button"
                  onClick={saveAdminPin}
                  className="whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
                >
                  Save PIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ring-1 ring-white/5">
            <div className="grid grid-cols-12 gap-0 border-b border-white/10 px-4 py-3 text-xs font-semibold tracking-wider text-white/50">
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
                  const barcode = r.items?.barcode || "—";
                  const statusTone = r.low ? "warn" : "good";

                  const onHandDisplay = Number.isFinite(r.on_hand as any) ? (r.on_hand as number) : 0;
                  const parDisplay = Number.isFinite(r.par_level as any) ? (r.par_level as number) : 0;

                  return (
                    <div
                      key={`${r.storage_area_id}:${r.item_id}`}
                      className="grid grid-cols-12 items-center gap-0 px-4 py-3 transition hover:bg-white/[0.04]"
                    >
                      <div className="col-span-3">
                        <div className="text-sm font-semibold">{areaName}</div>
                        <div className="mt-0.5 text-xs text-white/45">
                          {r.items?.vendor ? r.items.vendor : r.items?.category ? r.items.category : ""}
                        </div>
                      </div>

                      <div className="col-span-4">
                        <div className="text-sm font-semibold">{itemName}</div>
                        <div className="mt-0.5 text-xs text-white/45">
                          {r.items?.category ? `Category: ${r.items.category}` : ""}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-sm text-white/80 break-all">{barcode}</div>
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <input
                          disabled={locked}
                          value={String(onHandDisplay)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            const num = v === "" ? 0 : Number(v);
                            setRows((prev) =>
                              prev.map((x) =>
                                x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
                                  ? { ...x, on_hand: num }
                                  : x
                              )
                            );
                          }}
                          onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                          className={cn(
                            "w-20 rounded-xl bg-white/5 px-3 py-2 text-center text-sm font-semibold",
                            "ring-1 ring-white/10 outline-none focus:ring-white/30",
                            locked && "opacity-60"
                          )}
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <input
                          disabled={locked}
                          value={String(parDisplay)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            const num = v === "" ? 0 : Number(v);
                            setRows((prev) =>
                              prev.map((x) =>
                                x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
                                  ? { ...x, par_level: num }
                                  : x
                              )
                            );
                          }}
                          onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                          className={cn(
                            "w-20 rounded-xl bg-white/5 px-3 py-2 text-center text-sm font-semibold",
                            "ring-1 ring-white/10 outline-none focus:ring-white/30",
                            locked && "opacity-60"
                          )}
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <div className="flex items-center gap-2">
                          <Pill tone={statusTone as any}>{r.low ? "LOW" : "OK"}</Pill>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load more */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/45">
              Note: This edits only{" "}
              <span className="font-semibold text-white/70">storage_inventory.on_hand</span> and{" "}
              <span className="font-semibold text-white/70">storage_inventory.par_level</span>.
            </div>

            {hasMore && !loading && (
              <button
                onClick={() => fetchRows(false)}
                className="rounded-2xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-white/60">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-white/60">No results.</div>
            ) : (
              filtered.map((r) => {
                const areaName = r.storage_areas?.name || "(unknown area)";
                const itemName = r.items?.name || "(unknown item)";
                const barcode = r.items?.barcode || "—";

                const onHandDisplay = Number.isFinite(r.on_hand as any) ? (r.on_hand as number) : 0;
                const parDisplay = Number.isFinite(r.par_level as any) ? (r.par_level as number) : 0;

                return (
                  <div
                    key={`${r.storage_area_id}:${r.item_id}`}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 ring-1 ring-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs tracking-widest text-white/45">AREA</div>
                        <div className="text-lg font-extrabold break-words">{areaName}</div>

                        <div className="mt-2 text-xs tracking-widest text-white/45">ITEM</div>
                        <div className="text-base font-bold break-words">{itemName}</div>

                        <div className="mt-1 text-xs text-white/50 break-all">Barcode: {barcode}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Pill tone={r.low ? "warn" : "good"}>{r.low ? "LOW" : "OK"}</Pill>
                        {r.low_notified ? <Pill tone="warn">Notified</Pill> : <Pill>—</Pill>}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                        <div className="text-xs font-semibold text-white/50">ON HAND</div>
                        <input
                          disabled={locked}
                          value={String(onHandDisplay)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            const num = v === "" ? 0 : Number(v);
                            setRows((prev) =>
                              prev.map((x) =>
                                x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
                                  ? { ...x, on_hand: num }
                                  : x
                              )
                            );
                          }}
                          onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                          className={cn(
                            "mt-2 w-full rounded-xl bg-white/5 px-3 py-3 text-center text-lg font-extrabold",
                            "ring-1 ring-white/10 outline-none focus:ring-white/30",
                            locked && "opacity-60"
                          )}
                        />
                      </div>

                      <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                        <div className="text-xs font-semibold text-white/50">PAR</div>
                        <input
                          disabled={locked}
                          value={String(parDisplay)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            const num = v === "" ? 0 : Number(v);
                            setRows((prev) =>
                              prev.map((x) =>
                                x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
                                  ? { ...x, par_level: num }
                                  : x
                              )
                            );
                          }}
                          onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                          className={cn(
                            "mt-2 w-full rounded-xl bg-white/5 px-3 py-3 text-center text-lg font-extrabold",
                            "ring-1 ring-white/10 outline-none focus:ring-white/30",
                            locked && "opacity-60"
                          )}
                        />
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-white/45">Updates save when you tap out of the field.</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load more */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/45">
              Note: This edits only{" "}
              <span className="font-semibold text-white/70">storage_inventory.on_hand</span> and{" "}
              <span className="font-semibold text-white/70">storage_inventory.par_level</span>.
            </div>

            {hasMore && !loading && (
              <button
                onClick={() => fetchRows(false)}
                className="rounded-2xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
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
