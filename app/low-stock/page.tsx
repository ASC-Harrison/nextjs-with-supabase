"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* =======================
   Types
======================= */

type Item = {
  name: string;
  barcode: string;
  par_level: number;
  low_level: number;
};

type Location = {
  name: string;
};

type InventoryRow = {
  on_hand: number;
  status: string;
  items: Item[] | Item | null;
  locations: Location[] | Location | null;
};

/* =======================
   Page
======================= */

export default function LowStockPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* =======================
     Fetch Data
  ======================= */

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          on_hand,
          status,
          items (
            name,
            barcode,
            par_level,
            low_level
          ),
          locations (
            name
          )
        `
        )
        .eq("status", "LOW");

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as InventoryRow[]);
      setLoading(false);
    };

    fetchData();
  }, []);

  /* =======================
     Group by Location
  ======================= */

  const grouped = useMemo(() => {
    const map: Record<string, InventoryRow[]> = {};

    rows.forEach((r) => {
      const locName = Array.isArray(r.locations)
        ? r.locations[0]?.name
        : r.locations?.name;

      const location = locName ?? "Unknown Location";

      if (!map[location]) map[location] = [];
      map[location].push(r);
    });

    return map;
  }, [rows]);

  /* =======================
     UI States
  ======================= */

  if (loading) return <p className="p-4">Loading low stock…</p>;
  if (error) return <p className="p-4 text-red-600">Error: {error}</p>;

  /* =======================
     Render
  ======================= */

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Low Stock Items</h1>

      {Object.entries(grouped).map(([location, items]) => (
        <div key={location} className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">{location}</h2>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Item</th>
                <th className="text-left p-2">Barcode</th>
                <th className="text-right p-2">On Hand</th>
                <th className="text-right p-2">Par</th>
                <th className="text-right p-2">Low</th>
              </tr>
            </thead>

            <tbody>
              {items.map((r, i) => {
                const item = Array.isArray(r.items)
                  ? r.items[0]
                  : r.items;

                if (!item) return null;

                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.barcode}</td>
                    <td className="p-2 text-right">{r.on_hand}</td>
                    <td className="p-2 text-right">{item.par_level}</td>
                    <td className="p-2 text-right">{item.low_level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
