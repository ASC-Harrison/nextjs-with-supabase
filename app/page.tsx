"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = { id: string; name: string };
type ScanType = "OUT" | "IN";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState("");
  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState<number>(1);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  );

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        setToast({ type: "err", msg: "Could not load locations: " + error.message });
        return;
      }

      const rows = (data ?? []) as LocationRow[];
      setLocations(rows);
      if (rows.length > 0) setLocationId(rows[0].id);
    })();
  }, []);

  async function postJson(url: string, payload?: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function sendTestEmail() {
    setBusy(true);
    setToast(null);
    try {
      const { ok, status, data } = await postJson("/api/test-email");
      if (!ok) return setToast({ type: "err", msg: `${data?.error ?? "Test email failed"} (status ${status})` });
      setToast({ type: "ok", msg: "Test email sent ✅ Check your inbox/spam." });
    } finally {
      setBusy(false);
    }
  }

  async function submitScan() {
    setBusy(true);
    setToast(null);

    const cleanBarcode = barcode.trim();
    const cleanQty = Number(qty);

    try {
      if (!locationId) return setToast({ type: "err", msg: "Pick a location first." });
      if (!cleanBarcode) return setToast({ type: "err", msg: "Enter a barcode." });
      if (!Number.isFinite(cleanQty) || cleanQty <= 0) return setToast({ type: "err", msg: "Qty must be > 0." });

      const payload = {
        barcode: cleanBarcode,
        location_id: locationId, // ✅ UUID from locations table
        qty: cleanQty,
        direction: scanType, // "OUT" or "IN"
      };

      const { ok, status, data } = await postJson("/api/submit-scan", payload);
      if (!ok) return setToast({ type: "err", msg: `${data?.error ?? "Scan failed"} (status ${status})` });

      setToast({
        type: "ok",
        msg: `✅ ${data.item}: ${data.before} → ${data.after}${data.low_stock ? " (LOW)" : ""}`,
      });

      setBarcode("");
      setQty(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">ASC Inventory Live</h1>
              <p className="mt-1 text-sm text-slate-300">
                Scan IN / OUT updates on-hand. Low stock alerts email you automatically.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              v1
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {/* Location */}
            <div>
              <label className="text-sm font-medium text-slate-200">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={busy || locations.length === 0}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-sky-500"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-400">
                Selected: <span className="text-slate-200">{selectedLocation?.name ?? "—"}</span>
              </div>
            </div>

            {/* Scan type */}
            <div>
              <label className="text-sm font-medium text-slate-200">Scan Type</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScanType("OUT")}
                  disabled={busy}
                  className={classNames(
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    scanType === "OUT"
                      ? "border-sky-500 bg-sky-500/15 text-sky-200"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600"
                  )}
                >
                  OUT (use)
                </button>
                <button
                  onClick={() => setScanType("IN")}
                  disabled={busy}
                  className={classNames(
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    scanType === "IN"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600"
                  )}
                >
                  IN (restock)
                </button>
              </div>
            </div>

            {/* Barcode + Qty */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-200">Barcode</label>
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type"
                  disabled={busy}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200">Qty</label>
                <input
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  type="number"
                  min={1}
                  disabled={busy}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={submitScan}
                disabled={busy}
                className="w-full rounded-2xl bg-white/10 px-4 py-4 text-base font-semibold text-white hover:bg-white/15 disabled:opacity-60"
              >
                {busy ? "Working…" : "Submit Scan"}
              </button>

              <button
                onClick={sendTestEmail}
                disabled={busy}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-base font-semibold text-slate-200 hover:border-slate-600 disabled:opacity-60"
              >
                Send Test Email
              </button>
            </div>

            {/* Toast */}
            {toast ? (
              <div
                className={classNames(
                  "rounded-2xl border px-4 py-3 text-sm",
                  toast.type === "ok"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/50 bg-rose-500/10 text-rose-200"
                )}
              >
                {toast.msg}
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Tip: if a barcode doesn’t exist in inventory for that location, the API will auto-create it.
        </p>
      </div>
    </div>
  );
}
