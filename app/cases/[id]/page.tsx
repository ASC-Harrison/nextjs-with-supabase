"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Case = {
  id: string;
  scheduled_at: string | null;
  procedure: string;
  surgeon: string;
  room: string;
  notes: string | null;
  status: string;
};

type Line = {
  id: string;
  case_id: string;
  item_id: string;
  item_name: string;
  barcode: string | null;
  reference_number: string | null;
  planned_qty: number;
  reserved_qty: number;
  used_qty: number;
  source_area_id: string | null;
};

type Area = { id: string; name: string };

const LS = {
  STAFF: "asc_staff_name_v1",
  AREA: "asc_area_id_v1",
};

export default function CaseSessionPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = String(params?.id || "").trim();

  const [c, setC] = useState<Case | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // locations (same API you already have)
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState("");
  const selectedAreaName = useMemo(
    () => areas.find((a) => a.id === areaId)?.name ?? "—",
    [areas, areaId]
  );

  const [staff, setStaff] = useState("");

  // Add line UI (reuse your lookup API)
  const [lookupMode, setLookupMode] = useState<"REF" | "NAME" | "BARCODE">("REF");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [plannedQty, setPlannedQty] = useState(1);

  // One-time override (MAIN)
  const [mainOverride, setMainOverride] = useState(false);

  useEffect(() => {
    try {
      setStaff(localStorage.getItem(LS.STAFF) || "");
      const savedArea = localStorage.getItem(LS.AREA) || "";
      if (savedArea) setAreaId(savedArea);
    } catch {}
    loadLocations();
    loadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    try {
      if (areaId) localStorage.setItem(LS.AREA, areaId);
    } catch {}
  }, [areaId]);

  async function loadLocations() {
    try {
      const res = await fetch("/api/locations", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const list: Area[] = json.locations ?? [];
      setAreas(list);
      setAreaId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch {
      setAreas([]);
    }
  }

  async function loadCase() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/cases/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ case_id: caseId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setC(json.case);
      setLines(json.lines ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load case");
      setC(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }

  function fmt(dt: string | null) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  async function doLookup(full = true) {
    const q = query.trim();
    if (!q) return;

    setPicked(null);
    if (full) setMatches([]);

    const res = await fetch("/api/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ query: q, mode: lookupMode }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Lookup failed: ${json.error}`);

    if (json.item) {
      setPicked(json.item);
      setMatches([]);
      return;
    }

    setMatches(json.matches ?? []);
  }

  async function addLine() {
    if (!staff.trim()) return alert("Enter staff name (Audit tab in Inventory) first.");
    if (!picked?.id) return alert("Pick an item first.");
    if (plannedQty <= 0) return alert("Planned qty must be > 0.");

    const res = await fetch("/api/cases/add-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        case_id: caseId,
        item_id: picked.id,
        planned_qty: plannedQty,
        source_area_id: areaId || null,
        staff: staff.trim(),
        device_id: "web",
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Add line failed: ${json.error}`);

    setQuery("");
    setPicked(null);
    setMatches([]);
    setPlannedQty(1);

    await loadCase();
  }

  async function setReserved(line: Line, reservedQty: number) {
    if (!staff.trim()) return alert("Enter staff name first.");
    const res = await fetch("/api/cases/set-reserved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        case_line_id: line.id,
        reserved_qty: reservedQty,
        staff: staff.trim(),
        device_id: "web",
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Reserve failed: ${json.error}`);
    await loadCase();
  }

  async function addUsed(line: Line, qty: number) {
    if (!staff.trim()) return alert("Enter staff name first.");

    if (!mainOverride && !areaId) return alert("Select a cabinet location OR use MAIN override.");

    const res = await fetch("/api/cases/add-used", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        case_line_id: line.id,
        qty,
        storage_area_id: areaId,
        mainOverride,
        staff: staff.trim(),
        device_id: "web",
      }),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Use/Open failed: ${json.error}`);

    // One-time override resets after any use
    setMainOverride(false);

    await loadCase();
  }

  const totals = useMemo(() => {
    const planned = lines.reduce((s, l) => s + (l.planned_qty ?? 0), 0);
    const reserved = lines.reduce((s, l) => s + (l.reserved_qty ?? 0), 0);
    const used = lines.reduce((s, l) => s + (l.used_qty ?? 0), 0);
    return { planned, reserved, used };
  }, [lines]);

  return (
    <div className="min-h-screen w-full bg-black text-white flex justify-center">
      <div className="w-full max-w-md px-3 pb-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => router.push("/cases")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Cases
          </button>
          <button
            onClick={loadCase}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-2xl font-extrabold">Case Session</div>

          {loading ? (
            <div className="mt-2 text-sm text-white/60">Loading…</div>
          ) : err ? (
            <div className="mt-2 text-sm text-red-300 break-words">{err}</div>
          ) : c ? (
            <>
              <div className="mt-2 text-sm font-semibold break-words">{c.procedure}</div>
              <div className="mt-1 text-xs text-white/60 break-words">
                {c.surgeon || "—"} • {c.room || "—"} • {c.status}
              </div>
              <div className="mt-1 text-[11px] text-white/50">Scheduled: {fmt(c.scheduled_at)}</div>
              <div className="mt-1 text-[11px] text-white/50 break-all">Barcode/ID: {c.id}</div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-white/60">Planned</div>
                  <div className="text-lg font-extrabold">{totals.planned}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-white/60">Hold</div>
                  <div className="text-lg font-extrabold">{totals.reserved}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-white/60">Used</div>
                  <div className="text-lg font-extrabold">{totals.used}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Location + MAIN override */}
        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-sm text-white/70">Cabinet location used for “Use/Open”</div>
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10"
          >
            {areas.length === 0 ? (
              <option value="">No locations found</option>
            ) : (
              areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </select>

          <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">One-time MAIN override</div>
                <div className="mt-1 text-xs text-white/60">
                  If you grabbed the item from MAIN supply room.
                </div>
              </div>
              <button
                onClick={() => setMainOverride((v) => !v)}
                className={[
                  "rounded-2xl px-4 py-3 font-extrabold ring-1 text-sm",
                  mainOverride ? "bg-white text-black ring-white/20" : "bg-white/10 text-white ring-white/10",
                ].join(" ")}
              >
                MAIN (1x)
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/55">
              Active: {mainOverride ? "YES (MAIN)" : `NO (uses ${selectedAreaName})`}
            </div>
          </div>
        </div>

        {/* Add items to case */}
        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Add items to case</div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["BARCODE", "REF", "NAME"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setLookupMode(m);
                  setMatches([]);
                  setPicked(null);
                }}
                className={[
                  "rounded-2xl px-3 py-3 font-extrabold ring-1 text-xs",
                  lookupMode === m ? "bg-white text-black ring-white/20" : "bg-white/10 text-white ring-white/10",
                ].join(" ")}
              >
                {m === "BARCODE" ? "BARCODE" : m === "REF" ? "REF #" : "NAME"}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") await doLookup(true);
              }}
              className="flex-1 rounded-2xl bg-white text-black px-4 py-3"
              placeholder={lookupMode === "REF" ? "Type reference #" : lookupMode === "NAME" ? "Type item name" : "Type barcode"}
            />
            <button
              onClick={() => doLookup(true)}
              className="rounded-2xl bg-white px-4 py-3 font-extrabold text-black"
            >
              Find
            </button>
          </div>

          {picked && (
            <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
              <div className="text-sm font-semibold break-words">{picked.name}</div>
              <div className="mt-1 text-xs text-white/60 break-words">
                {picked.reference_number ? `Ref: ${picked.reference_number}` : "Ref: —"}{" "}
                • {picked.barcode ? `Barcode: ${picked.barcode}` : "Barcode: —"}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setPlannedQty((q) => Math.max(1, q - 1))}
                  className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/10 text-lg font-extrabold"
                >
                  −
                </button>
                <div className="flex-1 rounded-2xl bg-white text-black px-4 py-3 text-center font-extrabold">
                  Planned: {plannedQty}
                </div>
                <button
                  onClick={() => setPlannedQty((q) => q + 1)}
                  className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/10 text-lg font-extrabold"
                >
                  +
                </button>
              </div>

              <button
                onClick={addLine}
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-extrabold text-black"
              >
                Add to Case
              </button>
            </div>
          )}

          {matches.length > 0 && (
            <div className="mt-3 space-y-2">
              {matches.slice(0, 8).map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPicked(m);
                    setMatches([]);
                  }}
                  className="w-full text-left rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
                >
                  <div className="text-sm font-semibold break-words">{m.name}</div>
                  <div className="mt-1 text-xs text-white/60 break-words">
                    {m.reference_number ? `Ref: ${m.reference_number}` : "Ref: —"} •{" "}
                    {m.barcode ? `Barcode: ${m.barcode}` : "Barcode: —"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Case Items</div>
            <div className="text-xs text-white/60">{lines.length}</div>
          </div>

          <div className="mt-3 space-y-2">
            {lines.map((l) => {
              const remaining = Math.max(0, (l.planned_qty ?? 0) - (l.used_qty ?? 0));
              const hold = l.reserved_qty ?? 0;
              const used = l.used_qty ?? 0;

              return (
                <div key={l.id} className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-sm font-semibold break-words">{l.item_name}</div>
                  <div className="mt-1 text-xs text-white/60 break-words">
                    {l.reference_number ? `Ref: ${l.reference_number}` : "Ref: —"}
                    {" • "}
                    Planned: {l.planned_qty} • Hold: {hold} • Used: {used} • Remaining: {remaining}
                  </div>

                  {/* HOLD controls (reserve-only) */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setReserved(l, Math.max(0, hold - 1))}
                      className="rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold ring-1 ring-white/10"
                    >
                      HOLD −1
                    </button>
                    <button
                      onClick={() => setReserved(l, Math.min(l.planned_qty, hold + 1))}
                      className="rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold ring-1 ring-white/10"
                    >
                      HOLD +1
                    </button>
                    <button
                      onClick={() => setReserved(l, l.planned_qty)}
                      className="rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold ring-1 ring-white/10"
                    >
                      HOLD ALL
                    </button>
                  </div>

                  {/* USE controls (subtracts inventory) */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => addUsed(l, 1)}
                      className="rounded-2xl bg-white px-3 py-3 text-xs font-extrabold text-black"
                    >
                      OPEN/USE +1
                    </button>
                    <button
                      onClick={() => addUsed(l, Math.max(1, remaining))}
                      className="rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold ring-1 ring-white/10"
                    >
                      USE REMAINING
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] text-white/50">
                    HOLD does not change on-hand. OPEN/USE subtracts from inventory via apply_tx.
                  </div>
                </div>
              );
            })}

            {!loading && lines.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-3 text-sm text-white/60 ring-1 ring-white/10">
                No items yet — add the first line above.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-[11px] text-white/50 break-words">
          This module does not touch your existing inventory page. It’s a separate Case Mode you can keep improving.
        </div>
      </div>
    </div>
  );
}
