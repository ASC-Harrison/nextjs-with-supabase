"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ItemRow = {
  id: string;
  name: string;
};

type InventoryRow = {
  item_id: string;
  location_id: string;
  on_hand: number;
  status: string | null;
};

type LocationRow = {
  id: string;
  name: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load locations + items + inventory (for selected location)
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: locs, error: locErr } = await supabase
        .from("locations")
        .select("id,name")
        .order("name");

      if (!locErr && locs) {
        setLocations(locs as LocationRow[]);
        // default location (first) if none chosen yet
        if (!selectedLocationId && locs.length > 0) {
          setSelectedLocationId(locs[0].id);
        }
      }

      const { data: its, error: itemErr } = await supabase
        .from("items")
        .select("id,name")
        .order("name");

      if (!itemErr && its) {
        setItems(its as ItemRow[]);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load inventory whenever location changes
  useEffect(() => {
    if (!selectedLocationId) return;

    (async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("item_id,location_id,on_hand,status")
        .eq("location_id", selectedLocationId);

      if (!error && data) {
        setInventory(data as InventoryRow[]);
      }
    })();
  }, [selectedLocationId]);

  const locationName = useMemo(() => {
    return locations.find((l) => l.id === selectedLocationId)?.name ?? "—";
  }, [locations, selectedLocationId]);

  const inventoryByItemId = useMemo(() => {
    const map = new Map<string, InventoryRow>();
    for (const row of inventory) map.set(row.item_id, row);
    return map;
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50); // keep it fast
    return items
      .filter((i) => i.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [items, query]);

  function statusBadge(onHand: number, status: string | null) {
    // Use your DB status if you already compute it, otherwise infer
    const s = (status ?? "").toLowerCase();
    if (s.includes("out") || onHand === 0) return "OUT";
    if (s.includes("low")) return "LOW";
    return "OK";
  }

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Current Location</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{locationName}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginTop: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item name…"
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 14,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Tip: Start typing “gauze”, “suture”, “scope”, etc.
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>Items</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {loading ? "Loading…" : `${filteredItems.length} shown`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filteredItems.map((item) => {
            const inv = inventoryByItemId.get(item.id);
            const onHand = inv?.on_hand ?? 0;
            const badge = statusBadge(onHand, inv?.status ?? null);

            return (
              <button
                key={item.id}
                onClick={() => {
                  alert(
                    `Next step: open transaction modal for:\n\n${item.name}\nItem ID: ${item.id}\nLocation: ${locationName}`
                  );
                }}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #e5e5e5",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {badge}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>On hand:</span> {onHand}
                  </div>
                  {inv?.status ? (
                    <div>
                      <span style={{ fontWeight: 700 }}>Status:</span> {inv.status}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
