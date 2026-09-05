"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OWNER_EMAIL = "hogstud800@gmail.com";
const PAGE_SIZE = 250;
const REVIEW_THRESHOLD = 10;

type Activity = {
  id: string;
  changed_at: string;
  item_id: string | null;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  storage_area_id: string | null;
  storage_area_name: string;
  old_on_hand: number | string | null;
  new_on_hand: number | string | null;
  quantity_change: number | string | null;
  direction: "ADDED" | "REMOVED" | "PAR_CHANGED";
  old_par_level: number | string | null;
  new_par_level: number | string | null;
  changed_by: string | null;
};

type MovementFilter = "ALL" | "ADDED" | "REMOVED" | "PAR_CHANGED" | "REVIEW";
type DateFilter = "TODAY" | "7_DAYS" | "30_DAYS" | "ALL";
type LiveState = "CONNECTING" | "LIVE" | "OFFLINE";

function numberValue(value: number | string | null) {
  return Number(value ?? 0);
}

function formatNumber(value: number | string | null) {
  return numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function personLabel(value: string | null) {
  if (!value || value === "System" || value === "System / automated update") {
    return "System / automated update";
  }
  if (value === "Legacy app" || value === "App user (older history)") {
    return "App user (older history)";
  }

  const lower = value.toLowerCase();
  if (lower.includes("brooklyncarter.0716@gmail.com") || lower === "brooklyn carter") return "Brooklyn Carter";
  if (lower.includes("andrea.burris88@icloud.com") || lower === "andrea") return "Andrea";
  if (lower.includes("wsummer006@gmail.com") || lower === "summer") return "Summer";
  if (lower.includes("hogstud800@gmail.com") || lower === "jeremy" || lower === "jeremy johnson") return "Jeremy Johnson";
  return value;
}

function reviewReason(row: Activity) {
  const oldCount = numberValue(row.old_on_hand);
  const newCount = numberValue(row.new_on_hand);
  const change = Math.abs(newCount - oldCount);
  if (oldCount > 0 && newCount === 0) return "Item was set to zero";
  if (change >= REVIEW_THRESHOLD) return `Large change of ${formatNumber(change)} ${row.unit || "Each"}`;
  return "";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function InventoryActivityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [movement, setMovement] = useState<MovementFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("7_DAYS");
  const [error, setError] = useState("");
  const [liveState, setLiveState] = useState<LiveState>("CONNECTING");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function authorize() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email?.toLowerCase() ?? "";

      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (email !== OWNER_EMAIL) {
        router.replace("/");
        return;
      }
      if (!cancelled) setAuthorized(true);
    }

    void authorize();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (authorized) void loadActivity(true);
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("private-inventory-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_change_log" },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => void loadActivity(true, true), 500);
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") setLiveState("LIVE");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveState("OFFLINE");
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadActivity(true, true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [authorized]);

  async function loadActivity(reset: boolean, quiet = false) {
    if (!quiet) {
      reset ? setLoading(true) : setLoadingMore(true);
    }
    setError("");

    const start = reset ? 0 : rows.length;
    const { data, error: queryError } = await supabase
      .from("inventory_activity_view")
      .select("*")
      .order("changed_at", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (queryError) {
      setError("The activity history could not be loaded. Please refresh or sign in again.");
      console.error("Inventory activity load failed:", queryError);
    } else {
      const nextRows = (data ?? []) as Activity[];
      setRows(current => reset ? nextRows : [...current, ...nextRows]);
      setHasMore(nextRows.length === PAGE_SIZE);
      setLastUpdated(new Date());
    }

    setLoading(false);
    setLoadingMore(false);
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return rows.filter(row => {
      const countChanged = numberValue(row.old_on_hand) !== numberValue(row.new_on_hand);
      const visibleDirection = countChanged ? row.direction : "PAR_CHANGED";

      if (movement === "REVIEW" && !reviewReason(row)) return false;
      if (movement !== "ALL" && movement !== "REVIEW" && visibleDirection !== movement) return false;

      const changedTime = new Date(row.changed_at).getTime();
      if (dateFilter === "TODAY" && changedTime < startOfToday.getTime()) return false;
      if (dateFilter === "7_DAYS" && changedTime < now - 7 * 24 * 60 * 60 * 1000) return false;
      if (dateFilter === "30_DAYS" && changedTime < now - 30 * 24 * 60 * 60 * 1000) return false;

      if (!term) return true;
      return [
        row.item_name,
        row.reference_number,
        row.vendor,
        row.storage_area_name,
        personLabel(row.changed_by),
      ].some(value => value?.toLowerCase().includes(term));
    });
  }, [rows, search, movement, dateFilter]);

  const summary = useMemo(() => ({
    added: filteredRows.filter(row => numberValue(row.new_on_hand) > numberValue(row.old_on_hand)).length,
    removed: filteredRows.filter(row => numberValue(row.new_on_hand) < numberValue(row.old_on_hand)).length,
    par: filteredRows.filter(row =>
      numberValue(row.new_on_hand) === numberValue(row.old_on_hand) &&
      numberValue(row.new_par_level) !== numberValue(row.old_par_level)
    ).length,
    review: filteredRows.filter(row => Boolean(reviewReason(row))).length,
  }), [filteredRows]);

  function exportCsv() {
    const headers = [
      "Date & Time", "Action", "Item", "Reference #", "Vendor", "Unit",
      "Amount Changed", "Old Count", "New Count", "Location", "Changed By",
      "Old PAR", "New PAR", "Needs Review"
    ];

    const lines = filteredRows.map(row => {
      const difference = numberValue(row.new_on_hand) - numberValue(row.old_on_hand);
      const action = difference > 0 ? "ADDED" : difference < 0 ? "REMOVED" : "PAR CHANGED";
      return [
        new Date(row.changed_at).toLocaleString(),
        action,
        row.item_name,
        row.reference_number,
        row.vendor,
        row.unit || "Each",
        difference,
        numberValue(row.old_on_hand),
        numberValue(row.new_on_hand),
        row.storage_area_name,
        personLabel(row.changed_by),
        numberValue(row.old_par_level),
        numberValue(row.new_par_level),
        reviewReason(row),
      ].map(csvCell).join(",");
    });

    const csv = [headers.map(csvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authorized || loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#080d19", color: "#e2e8f0", display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🧾</div>
          <div style={{ fontWeight: 850 }}>Loading inventory activity…</div>
        </div>
      </main>
    );
  }

  const filterButton = (active: boolean): React.CSSProperties => ({
    border: active ? "1px solid rgba(96,165,250,.65)" : "1px solid rgba(148,163,184,.15)",
    background: active ? "rgba(37,99,235,.22)" : "rgba(30,41,59,.72)",
    color: active ? "#bfdbfe" : "#94a3b8",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    fontFamily: "inherit",
  });

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at 10% 0%,rgba(37,99,235,.16),transparent 30%),#080d19", color: "#f8fafc", padding: "14px 14px 50px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(145deg,rgba(30,41,59,.96),rgba(15,23,42,.96))", border: "1px solid rgba(96,165,250,.2)", borderRadius: 22, padding: 18, marginBottom: 12, boxShadow: "0 22px 55px rgba(0,0,0,.24)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/")} style={{ background: "rgba(30,41,59,.8)", border: "1px solid rgba(148,163,184,.16)", color: "#cbd5e1", borderRadius: 10, padding: "8px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>← Home</button>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={exportCsv} disabled={filteredRows.length === 0} style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(52,211,153,.25)", color: "#6ee7b7", borderRadius: 10, padding: "8px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>↓ Export</button>
              <button onClick={() => void loadActivity(true)} style={{ background: "rgba(37,99,235,.15)", border: "1px solid rgba(96,165,250,.3)", color: "#93c5fd", borderRadius: 10, padding: "8px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>↻ Refresh</button>
            </div>
          </div>
          <div style={{ marginTop: 17 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>Private owner history · Read-only</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: liveState === "LIVE" ? "#6ee7b7" : liveState === "OFFLINE" ? "#fca5a5" : "#fcd34d", fontSize: 9, fontWeight: 900 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", boxShadow: liveState === "LIVE" ? "0 0 9px currentColor" : "none" }} />
                {liveState === "LIVE" ? "LIVE UPDATES" : liveState}
              </span>
            </div>
            <h1 style={{ fontSize: 27, margin: "5px 0 5px", letterSpacing: "-.5px" }}>Inventory Activity</h1>
            <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5, margin: 0 }}>See who added or removed inventory, what changed, where it happened, and what may need your review.</p>
            {lastUpdated && <div style={{ color: "#475569", fontSize: 9, marginTop: 7 }}>Last updated {lastUpdated.toLocaleTimeString()}</div>}
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Added entries", value: summary.added, color: "#6ee7b7" },
            { label: "Removed entries", value: summary.removed, color: "#fca5a5" },
            { label: "PAR updates", value: summary.par, color: "#fcd34d" },
            { label: "Needs review", value: summary.review, color: "#fb923c" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "rgba(30,41,59,.75)", border: "1px solid rgba(148,163,184,.13)", borderRadius: 14, padding: "12px 10px" }}>
              <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 950, color: stat.color }}>{stat.value}</div>
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 9, textTransform: "uppercase", fontWeight: 900, letterSpacing: ".45px" }}>{stat.label}</div>
            </div>
          ))}
        </section>

        <section style={{ background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.12)", borderRadius: 17, padding: 12, marginBottom: 12 }}>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search item, reference, location, vendor, or person…"
            style={{ width: "100%", boxSizing: "border-box", background: "#0b1220", border: "1px solid rgba(148,163,184,.2)", color: "#f8fafc", borderRadius: 11, padding: "12px 13px", outline: "none", fontFamily: "inherit", fontSize: 13 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {([
              ["ALL", "All changes"],
              ["ADDED", "Added"],
              ["REMOVED", "Removed"],
              ["PAR_CHANGED", "PAR changed"],
              ["REVIEW", "⚠ Needs review"],
            ] as [MovementFilter, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setMovement(value)} style={filterButton(movement === value)}>{label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <label htmlFor="activity-date" style={{ color: "#64748b", fontSize: 10, fontWeight: 850 }}>TIME:</label>
            <select id="activity-date" value={dateFilter} onChange={event => setDateFilter(event.target.value as DateFilter)} style={{ flex: 1, background: "#0b1220", border: "1px solid rgba(148,163,184,.18)", color: "#cbd5e1", borderRadius: 10, padding: "9px 10px", fontFamily: "inherit", fontWeight: 750 }}>
              <option value="TODAY">Today</option>
              <option value="7_DAYS">Last 7 days</option>
              <option value="30_DAYS">Last 30 days</option>
              <option value="ALL">All loaded history</option>
            </select>
          </div>
          <div style={{ color: "#475569", fontSize: 9, marginTop: 8 }}>Needs Review flags changes of {REVIEW_THRESHOLD}+ units or an item being set to zero. It does not change inventory.</div>
        </section>

        {error && <div style={{ background: "rgba(127,29,29,.3)", border: "1px solid rgba(248,113,113,.3)", color: "#fecaca", borderRadius: 13, padding: 13, marginBottom: 10, fontSize: 12 }}>{error}</div>}

        <div style={{ display: "grid", gap: 9 }}>
          {filteredRows.map(row => {
            const oldCount = numberValue(row.old_on_hand);
            const newCount = numberValue(row.new_on_hand);
            const difference = newCount - oldCount;
            const countChanged = difference !== 0;
            const parChanged = numberValue(row.old_par_level) !== numberValue(row.new_par_level);
            const kind = countChanged ? (difference > 0 ? "ADDED" : "REMOVED") : "PAR_CHANGED";
            const color = kind === "ADDED" ? "#6ee7b7" : kind === "REMOVED" ? "#fca5a5" : "#fcd34d";
            const tint = kind === "ADDED" ? "rgba(16,185,129,.08)" : kind === "REMOVED" ? "rgba(239,68,68,.08)" : "rgba(245,158,11,.08)";
            const unit = row.unit || "Each";
            const review = reviewReason(row);

            return (
              <article key={row.id} style={{ background: `linear-gradient(145deg,${tint},rgba(15,23,42,.9))`, border: `1px solid ${review ? "rgba(251,146,60,.5)" : kind === "ADDED" ? "rgba(52,211,153,.2)" : kind === "REMOVED" ? "rgba(248,113,113,.2)" : "rgba(251,191,36,.2)"}`, borderRadius: 16, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color, fontSize: 10, fontWeight: 950, letterSpacing: ".7px" }}>{kind === "PAR_CHANGED" ? "PAR LEVEL CHANGED" : kind}</span>
                      {review && <span style={{ color: "#fdba74", background: "rgba(251,146,60,.12)", border: "1px solid rgba(251,146,60,.28)", borderRadius: 999, padding: "2px 6px", fontSize: 8, fontWeight: 950 }}>⚠ REVIEW</span>}
                    </div>
                    <div style={{ color: "#f8fafc", fontSize: 16, fontWeight: 900, marginTop: 3, lineHeight: 1.25 }}>{row.item_name}</div>
                  </div>
                  {countChanged && (
                    <div style={{ flexShrink: 0, color, background: tint, border: `1px solid ${color}44`, borderRadius: 11, padding: "8px 10px", fontSize: 16, fontWeight: 950 }}>
                      {difference > 0 ? "+" : "−"}{formatNumber(Math.abs(difference))} {unit}
                    </div>
                  )}
                </div>

                {review && <div style={{ color: "#fed7aa", background: "rgba(124,45,18,.25)", borderRadius: 9, padding: "7px 9px", marginTop: 10, fontSize: 10, fontWeight: 800 }}>{review}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 7, marginTop: 12 }}>
                  {countChanged && <Detail label="COUNT" value={`${formatNumber(row.old_on_hand)} → ${formatNumber(row.new_on_hand)} ${unit}`} />}
                  <Detail label="LOCATION" value={(row.storage_area_name || "Unknown location").trim()} />
                  <Detail label="CHANGED BY" value={personLabel(row.changed_by)} />
                  <Detail label="DATE & TIME" value={new Date(row.changed_at).toLocaleString()} />
                  {row.reference_number && <Detail label="REFERENCE #" value={row.reference_number} />}
                  {row.vendor && <Detail label="VENDOR" value={row.vendor} />}
                  {parChanged && <Detail label="PAR LEVEL" value={`${formatNumber(row.old_par_level)} → ${formatNumber(row.new_par_level)}`} />}
                </div>
              </article>
            );
          })}
        </div>

        {filteredRows.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#64748b", background: "rgba(30,41,59,.45)", border: "1px dashed rgba(148,163,184,.18)", borderRadius: 16, padding: "34px 18px", fontSize: 13 }}>No activity matches these filters.</div>
        )}

        {hasMore && (
          <button disabled={loadingMore} onClick={() => void loadActivity(false)} style={{ width: "100%", marginTop: 12, background: "rgba(37,99,235,.15)", border: "1px solid rgba(96,165,250,.28)", color: "#bfdbfe", borderRadius: 13, padding: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 850 }}>
            {loadingMore ? "Loading more…" : `Load more history (${rows.length} loaded)`}
          </button>
        )}
        <div style={{ color: "#475569", textAlign: "center", fontSize: 10, marginTop: 13 }}>This screen cannot change inventory. It only displays your protected activity record.</div>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.1)", borderRadius: 10, padding: "8px 9px", minWidth: 0 }}>
      <div style={{ color: "#475569", fontSize: 8, fontWeight: 950, letterSpacing: ".7px" }}>{label}</div>
      <div style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 750, marginTop: 3, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
