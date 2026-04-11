"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AlertItem = {
  item_id: string;
  name: string;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  order_status: string | null;
  backordered: boolean | null;
};

export default function AlertsPage() {
  const [items, setItems]       = useState<AlertItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastUpd, setLastUpd]   = useState("");

  async function loadAlerts() {
    setLoading(true);
    const { data } = await supabase
      .from("building_inventory_sheet_view")
      .select("item_id,name,total_on_hand,par_level,low_level,unit,order_status,backordered")
      .eq("is_active", true)
      .order("name", { ascending: true });

    const alerts = (data ?? []).filter((r: AlertItem) => {
      const oh  = r.total_on_hand ?? 0;
      const low = r.low_level ?? 0;
      return low > 0 && oh <= low;
    });

    setItems(alerts);
    setLastUpd(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60 * 1000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1e",
      color: "#e8f4ff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      padding: "20px 16px 60px",
    }}>

      {/* Header */}
      <div style={{
        maxWidth: 600,
        margin: "0 auto",
        marginBottom: 24,
        borderBottom: "1px solid rgba(99,179,237,0.15)",
        paddingBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 42, height: 42,
            background: "linear-gradient(135deg, #1a3a5c, #0d2137)",
            border: "1px solid #63b3ed",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
            boxShadow: "0 0 20px rgba(99,179,237,0.2)",
            flexShrink: 0,
          }}>⚕️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
              Baxter <span style={{ color: "#63b3ed" }}>ASC</span> — Low Stock Alerts
            </div>
            <div style={{ fontSize: 11, color: "#3d6480", marginTop: 2 }}>
              Auto-refreshes every minute · Last updated: {lastUpd || "—"}
            </div>
          </div>
        </div>

        <button
          onClick={loadAlerts}
          style={{
            background: "#63b3ed",
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          ↺ Refresh Now
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#3d6480" }}>
            Loading alerts…
          </div>
        ) : items.length === 0 ? (
          <div style={{
            background: "rgba(72,187,120,0.08)",
            border: "1px solid rgba(72,187,120,0.25)",
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#48bb78" }}>All Clear</div>
            <div style={{ fontSize: 13, color: "#7ba8c8", marginTop: 4 }}>
              No items at or below low level
            </div>
          </div>
        ) : (
          <>
            {/* Alert count banner */}
            <div style={{
              background: "rgba(252,129,129,0.08)",
              border: "1px solid rgba(252,129,129,0.25)",
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fc8181" }}>
                  {items.length} item{items.length !== 1 ? "s" : ""} at or below low level
                </div>
                <div style={{ fontSize: 12, color: "#7ba8c8", marginTop: 2 }}>
                  These items need to be restocked
                </div>
              </div>
            </div>

            {/* Alert items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((r) => {
                const oh  = r.total_on_hand ?? 0;
                const par = r.par_level ?? 0;
                const low = r.low_level ?? 0;
                const pct = par > 0 ? Math.round((oh / par) * 100) : 0;
                const isZero = oh === 0;

                return (
                  <div key={r.item_id} style={{
                    background: isZero ? "rgba(252,129,129,0.06)" : "rgba(246,173,85,0.06)",
                    border: `1px solid ${isZero ? "rgba(252,129,129,0.25)" : "rgba(246,173,85,0.25)"}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    borderLeft: `4px solid ${isZero ? "#fc8181" : "#f6ad55"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "break-word", lineHeight: 1.4 }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#7ba8c8", marginTop: 3 }}>
                          Status: {r.order_status || "IN STOCK"}{r.backordered ? " · BACKORDERED" : ""}
                        </div>
                      </div>
                      <div style={{
                        background: isZero ? "rgba(252,129,129,0.15)" : "rgba(246,173,85,0.15)",
                        border: `1px solid ${isZero ? "rgba(252,129,129,0.3)" : "rgba(246,173,85,0.3)"}`,
                        borderRadius: 10,
                        padding: "8px 14px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}>
                        <div style={{
                          fontSize: 24,
                          fontWeight: 900,
                          color: isZero ? "#fc8181" : "#f6ad55",
                          lineHeight: 1,
                        }}>{oh}</div>
                        <div style={{ fontSize: 10, color: "#7ba8c8", marginTop: 2 }}>
                          {r.unit || "on hand"}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      marginTop: 12,
                    }}>
                      {[
                        { label: "LOW LEVEL", value: low },
                        { label: "PAR", value: par },
                        { label: "% OF PAR", value: pct + "%" },
                      ].map(({ label, value }) => (
                        <div key={label} style={{
                          background: "rgba(0,0,0,0.2)",
                          borderRadius: 8,
                          padding: "7px 10px",
                          textAlign: "center",
                        }}>
                          <div style={{ fontSize: 9, color: "#3d6480", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
