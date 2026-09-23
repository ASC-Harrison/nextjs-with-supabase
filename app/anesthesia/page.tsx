"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useSessionTimeout } from "@/lib/use-session-timeout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ANESTHESIA_AREA = "Anesthesia";
const OPEN_STATUSES = new Set(["PENDING", "SEEN", "IN_ROUTE", "DELAYED"]);

type Item = {
  item_id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  total_on_hand: number;
  par_level: number;
  low_level: number;
  unit: string | null;
};

type RestockRequest = {
  id: string;
  item_id: string | null;
  item_name: string;
  requested_by: string;
  requested_from: string;
  status: string;
  created_at: string;
};

type InventoryRow = {
  item_id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Loading took too long. Tap Refresh and try again.")), ms)),
  ]);
}

function statusDetails(status: string) {
  const values: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Request Sent", color: "#fbbf24" },
    SEEN: { label: "Seen by Receiving", color: "#f87171" },
    IN_ROUTE: { label: "On the Way", color: "#60a5fa" },
    DELAYED: { label: "Delayed", color: "#fbbf24" },
    RESTOCKED: { label: "Restocked", color: "#34d399" },
    OUT_OF_STOCK: { label: "Out of Stock", color: "#fb7185" },
  };
  return values[status] || { label: status || "Pending", color: "#94a3b8" };
}

const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#080d19;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
  .k-root{min-height:100vh;color:#f8fafc;padding:12px 12px 110px;background:radial-gradient(circle at 12% 0%,rgba(157,34,53,.18),transparent 32%),radial-gradient(circle at 100% 24%,rgba(225,29,72,.08),transparent 28%),#080d19}
  .k-wrap{width:100%;max-width:980px;margin:0 auto}
  .k-header{position:sticky;top:0;z-index:30;margin:-12px -12px 12px;padding:14px 12px 12px;background:rgba(8,13,25,.93);border-bottom:1px solid rgba(148,163,184,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
  .k-header-in{max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .k-title{font-size:22px;font-weight:950;letter-spacing:-.6px}
  .k-sub{font-size:10px;color:#94a3b8;margin-top:3px}
  .k-back,.k-refresh{border:1px solid rgba(148,163,184,.16);background:rgba(30,41,59,.72);color:#cbd5e1;border-radius:10px;padding:8px 10px;font:800 11px inherit;cursor:pointer}
  .k-hero{border:1px solid rgba(248,113,113,.22);border-radius:20px;padding:15px;background:linear-gradient(145deg,rgba(46,16,101,.45),rgba(15,23,42,.92));box-shadow:0 20px 50px rgba(0,0,0,.22)}
  .k-hero-title{font-size:15px;font-weight:900;color:#fff1f2}
  .k-hero-copy{font-size:11px;color:#a5b4fc;line-height:1.45;margin-top:5px}
  .k-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}
  .k-stat{background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.11);border-radius:12px;padding:10px}
  .k-stat-num{font-size:20px;font-weight:950;line-height:1}
  .k-stat-label{font-size:8px;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin-top:5px}
  .k-recent{margin-top:12px;border:1px solid rgba(148,163,184,.13);border-radius:16px;padding:12px;background:rgba(15,23,42,.72)}
  .k-section-title{font-size:10px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
  .k-request-row{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px 0;border-bottom:1px solid rgba(148,163,184,.09)}
  .k-request-row:last-child{border-bottom:0}
  .k-request-name{font-size:11px;font-weight:800;color:#e2e8f0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .k-status{font-size:8px;font-weight:900;white-space:nowrap;border-radius:999px;padding:4px 7px;background:rgba(148,163,184,.08)}
  .k-tools{position:sticky;top:73px;z-index:25;margin:12px 0;padding:10px;background:rgba(15,23,42,.93);border:1px solid rgba(248,113,113,.15);border-radius:15px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .k-search{width:100%;border:1px solid #334155;background:#0b1323;color:#f8fafc;border-radius:11px;padding:12px;font:14px inherit;outline:none}
  .k-filter-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}
  .k-filter{border:1px solid rgba(148,163,184,.16);background:#172033;color:#94a3b8;border-radius:9px;padding:7px 10px;font:800 10px inherit;cursor:pointer}
  .k-filter.active{color:#fca5a5;border-color:rgba(248,113,113,.35);background:rgba(127,29,29,.18)}
  .k-count{font-size:9px;color:#526178;font-weight:800}
  .k-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:9px}
  .k-card{position:relative;overflow:hidden;border:1px solid rgba(148,163,184,.13);border-radius:15px;padding:13px;background:linear-gradient(145deg,rgba(30,41,59,.87),rgba(15,23,42,.91));box-shadow:0 12px 28px rgba(0,0,0,.13)}
  .k-card.low{border-color:rgba(248,113,113,.3)}
  .k-card::before{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:#34d399}
  .k-card.low::before{background:#fb7185}
  .k-card-name{font-size:13px;font-weight:900;color:#f1f5f9;line-height:1.3;padding-right:62px}
  .k-card-meta{font-size:9px;color:#64748b;line-height:1.5;margin-top:4px}
  .k-onhand{position:absolute;right:12px;top:12px;text-align:right}
  .k-onhand-num{font-size:19px;font-weight:950;color:#e2e8f0;line-height:1}
  .k-card.low .k-onhand-num{color:#fda4af}
  .k-onhand-label{font-size:7px;color:#64748b;font-weight:900;text-transform:uppercase;margin-top:3px}
  .k-levels{display:flex;gap:6px;margin:9px 0}
  .k-pill{font-size:8px;font-weight:850;color:#94a3b8;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.1);border-radius:6px;padding:4px 6px}
  .k-request{width:100%;border:1px solid rgba(248,113,113,.28);background:linear-gradient(145deg,rgba(157,34,53,.24),rgba(157,34,53,.18));color:#fee2e2;border-radius:10px;padding:9px;font:900 11px inherit;cursor:pointer}
  .k-request.requested{border-color:rgba(52,211,153,.22);background:rgba(16,185,129,.09);color:#6ee7b7;cursor:default}
  .k-loading,.k-empty,.k-error{text-align:center;border:1px solid rgba(148,163,184,.12);border-radius:15px;padding:28px;color:#64748b;background:rgba(15,23,42,.55)}
  .k-error{color:#fca5a5}
  .k-modal-wrap{position:fixed;inset:0;z-index:120;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:18px 10px}
  .k-modal{width:100%;max-width:520px;border:1px solid rgba(248,113,113,.26);border-radius:20px;padding:18px;background:linear-gradient(145deg,#1e293b,#0f172a);box-shadow:0 28px 80px rgba(0,0,0,.55)}
  .k-modal-title{font-size:17px;font-weight:950}
  .k-modal-copy{font-size:12px;color:#94a3b8;line-height:1.5;margin:7px 0 15px}
  .k-modal-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px}
  .k-cancel,.k-confirm{border-radius:11px;padding:11px;border:1px solid rgba(148,163,184,.17);font:900 12px inherit;cursor:pointer}
  .k-cancel{background:#1e293b;color:#94a3b8}.k-confirm{background:linear-gradient(145deg,#9d2235,#9d2235);color:#fff}
  .k-toast{position:fixed;z-index:150;left:50%;bottom:96px;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));border-radius:12px;padding:11px 13px;text-align:center;font-size:11px;font-weight:850;box-shadow:0 18px 50px rgba(0,0,0,.42)}
  .k-toast.ok{background:#064e3b;color:#a7f3d0;border:1px solid #059669}.k-toast.err{background:#7f1d1d;color:#fecaca;border:1px solid #dc2626}
  @media(max-width:620px){.k-root{padding:9px 9px 105px}.k-header{margin:-9px -9px 10px;padding:12px 9px 10px}.k-title{font-size:19px}.k-grid{grid-template-columns:1fr}.k-tools{top:65px}}
`;

export default function AnesthesiaRestockPage() {
  const router = useRouter();
  useSessionTimeout();

  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [staffName, setStaffName] = useState("Anesthesia Staff");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const displayName =
        session.user.user_metadata?.full_name ||
        session.user.email ||
        "Anesthesia Staff";
      setStaffName(displayName);

      const [inventoryResult, requestResponse] = await Promise.all([
        withTimeout(
          supabase
            .from("building_inventory_sheet_view")
            .select("item_id,name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          15000
        ),
        withTimeout(fetch("/api/restock-request", { cache: "no-store" }), 15000),
      ]);

      const inventory = inventoryResult as { data: InventoryRow[] | null; error: Error | null };
      if (inventory.error) throw inventory.error;

      const requestJson = await requestResponse.json();
      if (!requestJson.ok) throw new Error(requestJson.error || "Could not load restock requests.");

      setItems((inventory.data || []).map((row) => ({
        item_id: row.item_id,
        name: row.name,
        reference_number: row.reference_number,
        vendor: row.vendor,
        category: row.category,
        total_on_hand: Number(row.total_on_hand ?? 0),
        par_level: Number(row.par_level ?? 0),
        low_level: Number(row.low_level ?? 0),
        unit: row.unit,
      })));
      setRequests(
        (requestJson.data || [])
          .filter((request: RestockRequest) => request.requested_from === ANESTHESIA_AREA)
          .slice(0, 40)
      );
    } catch (error: unknown) {
      setError(errorMessage(error, "The inventory list could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadData(true), 400);
    };

    const channel = supabase
      .channel("anesthesia-restock-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "restock_requests" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_inventory" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, queueRefresh)
      .subscribe();

    const visible = () => {
      if (document.visibilityState === "visible") void loadData(true);
    };
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => void loadData(true), 60000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const activeByItem = useMemo(() => {
    const map = new Map<string, RestockRequest>();
    for (const request of requests) {
      if (!OPEN_STATUSES.has(request.status)) continue;
      const key = request.item_id || request.item_name.toLowerCase();
      if (!map.has(key)) map.set(key, request);
    }
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      const low = item.low_level > 0 && item.total_on_hand <= item.low_level;
      if (lowOnly && !low) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        (item.reference_number || "").toLowerCase().includes(query) ||
        (item.vendor || "").toLowerCase().includes(query) ||
        (item.category || "").toLowerCase().includes(query)
      );
    });
  }, [items, search, lowOnly]);

  const lowCount = items.filter(item => item.low_level > 0 && item.total_on_hand <= item.low_level).length;
  const openCount = requests.filter(request => OPEN_STATUSES.has(request.status)).length;

  async function submitRequest() {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const key = selected.item_id || selected.name.toLowerCase();
      if (activeByItem.has(key)) throw new Error("A restock request is already open for this item.");

      const response = await fetch("/api/restock-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selected.item_id,
          item_name: selected.name,
          requested_by: staffName || "Anesthesia Staff",
          requested_from: ANESTHESIA_AREA,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "The restock request could not be sent.");
      }

      setToast({ type: "ok", text: "Restock request sent for " + selected.name + "." });
      setSelected(null);
      await loadData(true);
    } catch (error: unknown) {
      setToast({ type: "err", text: errorMessage(error, "The restock request could not be sent.") });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="k-root">
        <div className="k-header">
          <div className="k-header-in">
            <button className="k-back" onClick={() => router.push("/")}>← Home</button>
            <div style={{ flex: 1 }}>
              <div className="k-title">Anesthesia Restock</div>
              <div className="k-sub">Anesthesia supply requests · full inventory search</div>
            </div>
            <button className="k-refresh" disabled={refreshing} onClick={() => void loadData(true)}>
              {refreshing ? "Checking…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        <div className="k-wrap">
          <section className="k-hero">
            <div className="k-hero-title">Request supplies without changing counts</div>
            <div className="k-hero-copy">
              Search every active inventory item and send Receiving a restock request. This page cannot add, subtract, or edit inventory.
            </div>
            <div className="k-stats">
              <div className="k-stat"><div className="k-stat-num">{items.length}</div><div className="k-stat-label">All Items</div></div>
              <div className="k-stat"><div className="k-stat-num" style={{ color: lowCount ? "#fda4af" : "#6ee7b7" }}>{lowCount}</div><div className="k-stat-label">Need Attention</div></div>
              <div className="k-stat"><div className="k-stat-num" style={{ color: "#fecaca" }}>{openCount}</div><div className="k-stat-label">Open Requests</div></div>
            </div>
          </section>

          {requests.length > 0 && (
            <section className="k-recent">
              <div className="k-section-title">Anesthesia’s Recent Requests</div>
              {requests.slice(0, 6).map(request => {
                const status = statusDetails(request.status);
                return (
                  <div className="k-request-row" key={request.id}>
                    <div className="k-request-name">{request.item_name}</div>
                    <div className="k-status" style={{ color: status.color }}>{status.label}</div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="k-tools">
            <input
              className="k-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search item, reference, vendor, or category…"
              aria-label="Search all inventory"
            />
            <div className="k-filter-row">
              <button className={"k-filter " + (lowOnly ? "active" : "")} onClick={() => setLowOnly(value => !value)}>
                {lowOnly ? "✓ Needs Attention" : "Needs Attention"}
              </button>
              <div className="k-count">Showing {filtered.length} of {items.length}</div>
            </div>
          </section>

          {loading ? (
            <div className="k-loading">Loading every active inventory item…</div>
          ) : error ? (
            <div className="k-error">
              {error}
              <div style={{ marginTop: 10 }}><button className="k-refresh" onClick={() => void loadData()}>Try Again</button></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="k-empty">No matching inventory items found.</div>
          ) : (
            <section className="k-grid">
              {filtered.map(item => {
                const low = item.low_level > 0 && item.total_on_hand <= item.low_level;
                const open = activeByItem.get(item.item_id) || activeByItem.get(item.name.toLowerCase());
                const status = open ? statusDetails(open.status) : null;
                return (
                  <article className={"k-card " + (low ? "low" : "")} key={item.item_id}>
                    <div className="k-card-name">{item.name}</div>
                    <div className="k-card-meta">
                      {item.reference_number || "No reference"} · {item.vendor || "Vendor not set"}<br />
                      {item.category || "Uncategorized"} · {item.unit || "Each"}
                    </div>
                    <div className="k-onhand">
                      <div className="k-onhand-num">{item.total_on_hand}</div>
                      <div className="k-onhand-label">On Hand</div>
                    </div>
                    <div className="k-levels">
                      <span className="k-pill">LOW {item.low_level}</span>
                      <span className="k-pill">PAR {item.par_level}</span>
                    </div>
                    {open ? (
                      <button className="k-request requested" disabled>✓ {status?.label}</button>
                    ) : (
                      <button className="k-request" onClick={() => setSelected(item)}>Request Restock</button>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>

      {selected && (
        <div className="k-modal-wrap" role="dialog" aria-modal="true" aria-label="Confirm restock request">
          <div className="k-modal">
            <div className="k-modal-title">Request restock?</div>
            <div className="k-modal-copy">
              Send Receiving a restock request for <strong style={{ color: "#f8fafc" }}>{selected.name}</strong>? This will not change its on-hand count.
            </div>
            <div className="k-modal-actions">
              <button className="k-cancel" disabled={submitting} onClick={() => setSelected(null)}>Cancel</button>
              <button className="k-confirm" disabled={submitting} onClick={() => void submitRequest()}>
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={"k-toast " + toast.type}>{toast.text}</div>}
    </>
  );
}
