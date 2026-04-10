"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { createClient } from "@supabase/supabase-js";

type ItemRow = {
  id: string;
  name: string;
  barcode: string | null;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  unit: string | null;
  is_active?: boolean | null;
};

type SelectedLabel = {
  id: string;
  item_id: string;
  name: string;
  barcode: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  qty: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function safeBarcodeValue(input: string) {
  return String(input || "")
    .trim()
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 64);
}

function makeFallbackBarcode(item: Partial<ItemRow>) {
  const raw = item.reference_number || item.name || item.id || "ITEM";
  return safeBarcodeValue(`ASC-${raw}`.replace(/\s+/g, "-").toUpperCase());
}

function barcodeText(item: ItemRow) {
  const existing = safeBarcodeValue(item.barcode || "");
  return existing || makeFallbackBarcode(item);
}

function LabelBarcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 54,
        displayValue: true,
        fontSize: 14,
        margin: 4,
        textMargin: 2,
        background: "#ffffff",
      });
    } catch {
      try {
        JsBarcode(svgRef.current, "INVALID", {
          format: "CODE128",
          width: 2,
          height: 54,
          displayValue: true,
          fontSize: 14,
          margin: 4,
          textMargin: 2,
          background: "#ffffff",
        });
      } catch {
        // no-op
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="w-full h-auto" />;
}

export default function BarcodeLabelGeneratorPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedLabel[]>([]);
  const [copies, setCopies] = useState(1);
  const [includeRef, setIncludeRef] = useState(true);
  const [includeVendor, setIncludeVendor] = useState(false);
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">("medium");
  const [showOnlyWithBarcode, setShowOnlyWithBarcode] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("items")
        .select("id, name, barcode, reference_number, vendor, category, unit, is_active")
        .or("is_active.is.null,is_active.eq.true")
        .order("name", { ascending: true });

      if (!active) return;

      if (error) {
        setError(error.message || "Failed to load items.");
        setItems([]);
      } else {
        setItems((data as ItemRow[]) || []);
      }

      setLoading(false);
    }

    loadItems();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (showOnlyWithBarcode && !safeBarcodeValue(item.barcode || "")) return false;
      if (!q) return true;

      return [
        item.name,
        item.barcode || "",
        item.reference_number || "",
        item.vendor || "",
        item.category || "",
        item.unit || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, showOnlyWithBarcode]);

  function addItem(item: ItemRow) {
    const code = barcodeText(item);

    setSelected((prev) => {
      const existing = prev.find((x) => x.item_id === item.id && x.barcode === code);
      if (existing) {
        return prev.map((x) =>
          x.id === existing.id ? { ...x, qty: x.qty + Math.max(1, copies) } : x
        );
      }

      return [
        {
          id: `${item.id}-${code}`,
          item_id: item.id,
          name: item.name,
          barcode: code,
          reference_number: item.reference_number,
          vendor: item.vendor,
          category: item.category,
          qty: Math.max(1, copies),
        },
        ...prev,
      ];
    });
  }

  function removeSelected(id: string) {
    setSelected((prev) => prev.filter((x) => x.id !== id));
  }

  function updateQty(id: string, qty: number) {
    setSelected((prev) =>
      prev.map((x) => (x.id === id ? { ...x, qty: Math.max(1, qty || 1) } : x))
    );
  }

  function clearAll() {
    setSelected([]);
  }

  function printLabels() {
    window.print();
  }

  const expandedLabels = useMemo(() => {
    const out: SelectedLabel[] = [];
    for (const row of selected) {
      for (let i = 0; i < row.qty; i++) out.push(row);
    }
    return out;
  }, [selected]);

  const gridClass =
    labelSize === "small"
      ? "grid-cols-3"
      : labelSize === "large"
      ? "grid-cols-1"
      : "grid-cols-2";

  const cardHeight =
    labelSize === "small"
      ? "min-h-[150px]"
      : labelSize === "large"
      ? "min-h-[220px]"
      : "min-h-[180px]";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            padding: 0 !important;
            margin: 0 !important;
          }
          .label-grid {
            gap: 8px !important;
          }
          .label-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #ddd !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Barcode Label Generator</h1>
              <p className="text-sm text-slate-600">
                Pull items from Supabase, build printable labels, and scan them in your inventory app.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={printLabels}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Print Labels
              </button>
              <button
                onClick={clearAll}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Selected
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by item, barcode, reference, vendor..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Default Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Label Size
                  </label>
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value as "small" | "medium" | "large")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeRef}
                    onChange={(e) => setIncludeRef(e.target.checked)}
                  />
                  Show ref #
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeVendor}
                    onChange={(e) => setIncludeVendor(e.target.checked)}
                  />
                  Show vendor
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOnlyWithBarcode}
                    onChange={(e) => setShowOnlyWithBarcode(e.target.checked)}
                  />
                  Only items with barcode
                </label>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Items</h2>
              <span className="text-xs text-slate-500">{filtered.length} found</span>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200">
              {loading ? (
                <div className="p-4 text-sm text-slate-500">Loading items...</div>
              ) : error ? (
                <div className="p-4 text-sm text-red-600">{error}</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No matching items found.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filtered.map((item) => {
                    const code = barcodeText(item);
                    const hasRealBarcode = !!safeBarcodeValue(item.barcode || "");

                    return (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="block w-full px-3 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {item.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.reference_number ? `Ref: ${item.reference_number}` : "No ref #"}
                              {item.vendor ? ` • ${item.vendor}` : ""}
                              {item.category ? ` • ${item.category}` : ""}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-600">
                              Barcode: {code}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                              hasRealBarcode
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {hasRealBarcode ? "Saved" : "Fallback"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="print-area rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <div className="no-print mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Selected Labels</h2>
                <p className="text-xs text-slate-500">
                  {selected.length} items selected • {expandedLabels.length} labels to print
                </p>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="no-print mb-4 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Item</th>
                      <th className="px-3 py-2 text-left font-semibold">Barcode</th>
                      <th className="px-3 py-2 text-left font-semibold">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.reference_number || "No ref #"}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{row.barcode}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => updateQty(row.id, Number(e.target.value) || 1)}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeSelected(row.id)}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expandedLabels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                Select items from the left to build printable barcode labels.
              </div>
            ) : (
              <div className={`label-grid grid ${gridClass} gap-3`}>
                {expandedLabels.map((row, idx) => (
                  <div
                    key={`${row.id}-${idx}`}
                    className={`label-card ${cardHeight} rounded-2xl border border-slate-300 bg-white p-3 shadow-sm`}
                  >
                    <div className="mb-2">
                      <div className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
                        {row.name}
                      </div>
                      {includeRef && row.reference_number ? (
                        <div className="mt-1 text-xs text-slate-600">Ref: {row.reference_number}</div>
                      ) : null}
                      {includeVendor && row.vendor ? (
                        <div className="mt-1 text-xs text-slate-600">{row.vendor}</div>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                      <LabelBarcode value={row.barcode} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
