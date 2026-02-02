"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Row = {
  on_hand: number;
  status: string;
  items: {
    name: string;
    barcode: string;
    par_level: number;
    low_level: number;
  } | null;
  locations: {
    name: string;
  } | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LowStockPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  async function load() {
    setErr("");
    setBusy(true);
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setErr(
          "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
        return;
      }

      // Pull LOW rows + join item + location
      const { data, error } = await supabase
        .from("inventory")
        .select(
          "on_hand,status, items(name,barcode,par_level,low_level), locations(name)"
        )
        .eq("status", "LOW");

      if (error) {
        setErr(error.message);
        return;
      }

      setRows((data ?? []) as Row[]);
      setLastUpdated(new Date().toLocaleString());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();

    // Optional: auto-refresh every 15s (simple + reliable)
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const loc = r.locations?.name ?? "Unknown Location";
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(r);
    }
    // sort each group by item name
    for (const [k, v] of map.entries()) {
      v.sort((a, b) =>
        (a.items?.name ?? "").localeCompare(b.items?.name ?? "")
      );
      map.set(k, v);
    }
    // return sorted locations
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 16,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
            Low Stock
          </h1>
          <div style={{ color: "#555", fontSize: 13 }}>
            Updates as you scan. Last updated: {lastUpdated || "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/"
            style={{
              padding: "10px 14px",
              border: "1px solid #ccc",
              borderRadius: 10,
              textDecoration: "none",
              color: "#111",
              fontWeight: 700,
              background: "#fff",
            }}
          >
            ← Scan
          </a>

          <button
            onClick={load}
            disabled={busy}
            style={{
              padding: "10px 14px",
              border: "1px solid #111",
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            background: "#ffe8e8",
            border: "1px solid #ffb4b4",
            padding: 12,
            borderRadius: 12,
          }}
        >
          <strong>Error:</strong> {err}
          <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
            If you see “permission denied” you may need logged-in access /
            policies in :contentReference[oaicite:1]{index=1}.
          </div>
        </div>
      ) : null}

      <section style={{ marginTop: 12 }}>
        {grouped.length === 0 ? (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              background: "#fafafa",
            }}
          >
            ✅ No low-stock items right now.
          </div>
        ) : (
          grouped.map(([locName, list]) => (
            <div
              key={locName}
              style={{
                marginBottom: 14,
                border: "1px solid #ddd",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 12,
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{locName}</span>
                <span style={{ opacity: 0.9 }}>{list.length} LOW</span>
              </div>

              <div style={{ padding: 12, display: "grid", gap: 10 }}>
                {list.map((r, idx) => {
                  const item = r.items;
                  const need =
                    item?.par_level != null
                      ? Math.max(item.par_level - (r.on_hand ?? 0), 0)
                      : null;

                  return (
                    <div
                      key={`${locName}-${item?.barcode ?? "x"}-${idx}`}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>
                          {item?.name ?? "Unknown Item"}
                        </div>
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid #ffb4b4",
                            background: "#ffe8e8",
                            fontWeight: 900,
                          }}
                        >
                          LOW
                        </div>
                      </div>

                      <div style={{ marginTop: 6, color: "#444", fontSize: 13 }}>
                        Barcode: <strong>{item?.barcode ?? "—"}</strong>
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14 }}>
                          On hand: <strong>{r.on_hand ?? 0}</strong>
                        </div>
                        <div style={{ fontSize: 14 }}>
                          Low level: <strong>{item?.low_level ?? 0}</strong>
                        </div>
                        <div style={{ fontSize: 14 }}>
                          PAR: <strong>{item?.par_level ?? 0}</strong>
                        </div>
                        <div style={{ fontSize: 14 }}>
                          Need to reach PAR: <strong>{need ?? "—"}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
