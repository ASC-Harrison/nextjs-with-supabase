"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = {
  location_name: string;
  barcode: string;
  item_name: string;
  par_level: number;
  on_hand: number;
  status: string;
  updated_at: string;
};

export default function LowStockPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      // Join inventory -> items + locations
      const { data, error } = await supabase
        .from("inventory")
        .select(`
  location_id,
  on_hand,
  items!inventory_item_id_fkey (
    name,
    barcode,
    par_level
  ),
  locations (
    name
  )
`)

        .eq("status", "LOW")
        .order("updated_at", { ascending: false });

      if (error) {
        setErr(error.message);
        return;
      }

      const mapped: Row[] =
        (data ?? []).map((r: any) => ({
          location_name: r.locations?.name ?? "",
          barcode: r.items?.barcode ?? "",
          item_name: r.items?.name ?? "",
          par_level: r.items?.par_level ?? 0,
          on_hand: r.on_hand ?? 0,
          status: r.status ?? "",
          updated_at: r.updated_at ?? "",
        })) ?? [];

      setRows(mapped);
    })();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Low Stock Items</h1>
      <p style={{ opacity: 0.75 }}>
        Items where <b>on_hand</b> is below <b>par_level</b>.
      </p>

      <div style={{ margin: "12px 0" }}>
        <a href="/" style={{ textDecoration: "underline" }}>
          ← Back to Scan
        </a>
      </div>

      {err ? (
        <div style={{ padding: 12, borderRadius: 10, background: "#ffe5e5", color: "#7a0000" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f6f6f6" }}>
              <th style={{ padding: 10, textAlign: "left" }}>Location</th>
              <th style={{ padding: 10, textAlign: "left" }}>Item</th>
              <th style={{ padding: 10, textAlign: "left" }}>Barcode</th>
              <th style={{ padding: 10, textAlign: "right" }}>Par</th>
              <th style={{ padding: 10, textAlign: "right" }}>On hand</th>
              <th style={{ padding: 10, textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                  No LOW items right now.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>{r.location_name}</td>
                  <td style={{ padding: 10 }}>{r.item_name}</td>
                  <td style={{ padding: 10 }}>{r.barcode}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>{r.par_level}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>{r.on_hand}</td>
                  <td style={{ padding: 10 }}>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

