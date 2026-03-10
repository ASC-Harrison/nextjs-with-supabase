"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type ProcedureRow = {
  id: string;
  name: string;
  surgeon: string | null;
  notes: string | null;
  created_at: string;
};

type AreaRow = {
  id: string;
  name: string;
};

type ItemRow = {
  id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
};

type PrefViewRow = {
  id: string;
  procedure_id: string;
  procedure_name: string;
  surgeon: string | null;
  item_id: string;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  unit: string | null;
  source_area_id: string | null;
  source_area_name: string | null;
  default_qty: number;
  notes: string | null;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PreferenceCardsAdminPage() {
  const router = useRouter();

  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [prefRows, setPrefRows] = useState<PrefViewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProcedure, setSavingProcedure] = useState(false);
  const [savingCardItem, setSavingCardItem] = useState(false);

  const [status, setStatus] = useState("");

  const [procedureName, setProcedureName] = useState("");
  const [procedureSurgeon, setProcedureSurgeon] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");

  const [selectedProcedureId, setSelectedProcedureId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<ItemRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [qty, setQty] = useState("1");
  const [cardNotes, setCardNotes] = useState("");

  const selectedProcedure = useMemo(
    () => procedures.find((p) => p.id === selectedProcedureId) ?? null,
    [procedures, selectedProcedureId]
  );

  const rowsForProcedure = useMemo(() => {
    if (!selectedProcedureId) return [];
    return prefRows.filter((r) => r.procedure_id === selectedProcedureId);
  }, [prefRows, selectedProcedureId]);

  async function loadAll() {
    setLoading(true);
    setStatus("");

    try {
      const [procRes, areaRes, prefRes] = await Promise.all([
        supabase
          .from("procedures")
          .select("id,name,surgeon,notes,created_at")
          .order("name", { ascending: true }),
        supabase
          .from("storage_areas")
          .select("id,name")
          .order("name", { ascending: true }),
        supabase
          .from("preference_card_items_view")
          .select(
            "id,procedure_id,procedure_name,surgeon,item_id,item_name,reference_number,vendor,category,unit,source_area_id,source_area_name,default_qty,notes,created_at"
          )
          .order("procedure_name", { ascending: true }),
      ]);

      if (procRes.error) throw procRes.error;
      if (areaRes.error) throw areaRes.error;
      if (prefRes.error) throw prefRes.error;

      const procData = (procRes.data ?? []) as ProcedureRow[];
      const areaData = (areaRes.data ?? []) as AreaRow[];
      const prefData = (prefRes.data ?? []) as PrefViewRow[];

      setProcedures(procData);
      setAreas(areaData);
      setPrefRows(prefData);

      if (!selectedProcedureId && procData.length > 0) {
        setSelectedProcedureId(procData[0].id);
      }

      if (!selectedAreaId && areaData.length > 0) {
        setSelectedAreaId(areaData[0].id);
      }
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to load admin preference card data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = itemSearch.trim();
    if (q.length < 2) {
      setItemResults([]);
      return;
    }

    const t = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,name,reference_number,vendor,category")
        .or(
          `name.ilike.%${q}%,reference_number.ilike.%${q}%,vendor.ilike.%${q}%,category.ilike.%${q}%`
        )
        .order("name", { ascending: true })
        .limit(12);

      if (!error) {
        setItemResults((data ?? []) as ItemRow[]);
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [itemSearch]);

  async function createProcedure() {
    const name = procedureName.trim();
    if (!name) {
      alert("Enter a procedure name.");
      return;
    }

    setSavingProcedure(true);
    setStatus("");

    try {
      const res = await fetch("/api/admin/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name,
          surgeon: procedureSurgeon.trim() || null,
          notes: procedureNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        alert(`Create procedure failed: ${json.error}`);
        return;
      }

      setProcedureName("");
      setProcedureSurgeon("");
      setProcedureNotes("");

      await loadAll();

      if (json.procedure?.id) {
        setSelectedProcedureId(json.procedure.id);
      }

      setStatus("Procedure created ✅");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to create procedure.");
    } finally {
      setSavingProcedure(false);
    }
  }

  async function addPreferenceCardItem() {
    if (!selectedProcedureId) {
      alert("Choose a procedure first.");
      return;
    }
    if (!selectedItem?.id) {
      alert("Choose an item first.");
      return;
    }
    if (!selectedAreaId) {
      alert("Choose a source area.");
      return;
    }

    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Quantity must be 1 or more.");
      return;
    }

    setSavingCardItem(true);
    setStatus("");

    try {
      const res = await fetch("/api/admin/preference-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          procedure_id: selectedProcedureId,
          item_id: selectedItem.id,
          source_area_id: selectedAreaId,
          default_qty: Math.trunc(n),
          notes: cardNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        alert(`Add card item failed: ${json.error}`);
        return;
      }

      setSelectedItem(null);
      setItemSearch("");
      setItemResults([]);
      setQty("1");
      setCardNotes("");

      await loadAll();
      setStatus("Preference card item added ✅");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to add preference card item.");
    } finally {
      setSavingCardItem(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-5xl px-4 pb-10">
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Back
          </button>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            Admin
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-3xl font-extrabold">Preference Cards Admin</div>
          <div className="mt-1 text-sm text-white/60">
            Create procedures, attach items, and build case pick lists without touching counts.
          </div>
          <div className="mt-2 text-xs text-green-300">
            Safe mode: this page does not subtract inventory or change totals.
          </div>
        </div>

        {status && (
          <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
            {status}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-bold">Create Procedure</div>

            <div className="mt-3">
              <div className="mb-1 text-xs text-white/60">Procedure name</div>
              <input
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-black"
                placeholder="e.g. Total Knee"
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs text-white/60">Surgeon</div>
              <input
                value={procedureSurgeon}
                onChange={(e) => setProcedureSurgeon(e.target.value)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-black"
                placeholder="e.g. Dr Smith"
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs text-white/60">Notes</div>
              <textarea
                value={procedureNotes}
                onChange={(e) => setProcedureNotes(e.target.value)}
                className="min-h-[90px] w-full rounded-2xl bg-white px-4 py-3 text-black"
                placeholder="Optional notes"
              />
            </div>

            <button
              onClick={createProcedure}
              disabled={savingProcedure}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-extrabold text-black disabled:opacity-60"
            >
              {savingProcedure ? "Saving..." : "Create Procedure"}
            </button>
          </div>

          <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-lg font-bold">Choose Procedure</div>

            <div className="mt-3">
              <select
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-black"
              >
                <option value="">Select procedure...</option>
                {procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.surgeon ? ` — ${p.surgeon}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedProcedure && (
              <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold">{selectedProcedure.name}</div>
                <div className="mt-1 text-xs text-white/60">
                  Surgeon: {selectedProcedure.surgeon ?? "—"}
                </div>
                {selectedProcedure.notes && (
                  <div className="mt-1 text-xs text-white/60">
                    Notes: {selectedProcedure.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-lg font-bold">Add Item To Preference Card</div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-white/60">Search item</div>
              <input
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setSelectedItem(null);
                }}
                className="w-full rounded-2xl bg-white px-4 py-3 text-black"
                placeholder="Search by item name, ref #, vendor..."
              />

              {itemResults.length > 0 && (
                <div className="mt-2 space-y-2">
                  {itemResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedItem(r);
                        setItemSearch(r.name);
                        setItemResults([]);
                      }}
                      className="w-full rounded-2xl bg-black/30 p-3 text-left ring-1 ring-white/10"
                    >
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {r.reference_number ?? "—"} • {r.vendor ?? "—"} • {r.category ?? "—"}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedItem && (
                <div className="mt-2 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <div className="text-sm font-semibold">{selectedItem.name}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {selectedItem.reference_number ?? "—"} • {selectedItem.vendor ?? "—"} •{" "}
                    {selectedItem.category ?? "—"}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-xs text-white/60">Source area</div>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-black"
              >
                <option value="">Select source area...</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs text-white/60">Qty</div>
                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-black"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-white/60">Notes</div>
                  <input
                    value={cardNotes}
                    onChange={(e) => setCardNotes(e.target.value)}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-black"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={addPreferenceCardItem}
            disabled={savingCardItem}
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-extrabold text-black disabled:opacity-60"
          >
            {savingCardItem ? "Saving..." : "Add To Preference Card"}
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-bold">Saved Preference Card Items</div>
            <div className="text-xs text-white/60">
              {loading ? "Loading..." : `${rowsForProcedure.length} items`}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Loading...</div>
          ) : !selectedProcedureId ? (
            <div className="mt-3 text-sm text-white/60">Choose a procedure to view items.</div>
          ) : rowsForProcedure.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">No items saved for this procedure yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {rowsForProcedure.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold break-words">{r.item_name}</div>
                      <div className="mt-1 text-xs text-white/60 break-words">
                        {r.reference_number ?? "—"} • {r.vendor ?? "—"} • {r.category ?? "—"}
                      </div>
                      <div className="mt-1 text-xs text-white/60 break-words">
                        Pull from: {r.source_area_name ?? "—"}
                      </div>
                      {r.notes && (
                        <div className="mt-1 text-xs text-white/60 break-words">
                          Notes: {r.notes}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-center ring-1 ring-white/10">
                      <div className="text-lg font-extrabold">{r.default_qty}</div>
                      <div className="text-[10px] text-white/60">qty</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
