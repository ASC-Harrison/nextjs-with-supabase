"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type StorageAreaRow = {
  id: string;
  name: string;
  active?: boolean | null;
  sort_order?: number | null;
};

type ItemRow = { id: string; name: string; barcode: string | null };
type InventoryRow = {
  id: string;
  item_id: string;
  location_id: string; // NOTE: keep this as your inventory column name
  on_hand: number;
  par_level: number;
};

type Tab = "transaction" | "totals" | "settings";

const DEFAULT_PIN = "2580";

export default function Home() {
  const [tab, setTab] = useState<Tab>("transaction");

  // storage areas (locations)
  const [areas, setAreas] = useState<StorageAreaRow[]>([]);
  const [areaId, setAreaId] = useState<string>("");
  const [locked, setLocked] = useState<boolean>(true);
  const [pin, setPin] = useState("");

  // one-time main override
  const [mainOverride, setMainOverride] = useState<boolean>(false);

  // item search / transaction
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundItem, setFoundItem] = useState<ItemRow | null>(null);
  const [foundInventory, setFoundInventory] = useState<InventoryRow | null>(null);

  // qty
  const [qty, setQty] = useState<number>(1);

  // add item
  const [newName, setNewName] = useState("");
  const [newBarcode, setNewBarcode] = useState("");

  const currentArea = useMemo(
    () => areas.find((a) => a.id === areaId) || null,
    [areas, areaId]
  );

  // Find MAIN supply area by name
  const mainAreaId = useMemo(() => {
    const main = areas.find((a) => (a.name || "").toLowerCase().includes("main"));
    return main?.id || "";
  }, [areas]);

  // Effective location for this ONE transaction
  const effectiveAreaId = useMemo(() => {
    if (mainOverride && mainAreaId) return mainAreaId;
    return areaId;
  }, [mainOverride, mainAreaId, areaId]);

  // Load storage areas
  useEffect(() => {
    (async () => {
      // Try to select optional columns if they exist
      const { data, error } = await supabase
        .from("storage_areas")
        .select("id,name,active,sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (error) {
        console.error("storage_areas load error:", error);
        setAreas([]);
        return;
      }

      const activeOnly = (data || []).filter((r) => r.active !== false);
      setAreas(activeOnly);

      if (!areaId && activeOnly.length) {
        const nonMain = activeOnly.find((a) => !a.name.toLowerCase().includes("main"));
        setAreaId(nonMain?.id || activeOnly[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlockIfPinValid() {
    if (pin.trim() === DEFAULT_PIN) {
      setLocked(false);
      setPin("");
      return true;
    }
    alert("Wrong PIN");
    return false;
  }

  function clearTransaction() {
    setFoundItem(null);
    setFoundInventory(null);
    setQuery("");
    setQty(1);
    setNewName("");
    setNewBarcode("");
  }

  function handleChangeArea(nextId: string) {
    if (locked) {
      alert("Locked. Enter PIN in Settings to unlock location changes.");
      return;
    }
    setAreaId(nextId);
    setMainOverride(false);
    clearTransaction();
  }

  async function runSearch() {
    setSearching(true);
    setFoundItem(null);
    setFoundInventory(null);

    const q = query.trim();
    if (!q) {
      setSearching(false);
      return;
    }

    // 1) find item
    const { data: items, error: itemErr } = await supabase
      .from("items")
      .select("id,name,barcode")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(1);

    if (itemErr) {
      console.error("item search error:", itemErr);
      setSearching(false);
      return;
    }

    const item = items?.[0] || null;
    setFoundItem(item);

    if (!item) {
      setSearching(false);
      return;
    }

    // 2) load inventory for effective area
    if (!effectiveAreaId) {
      setSearching(false);
      return;
    }

    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("id,item_id,location_id,on_hand,par_level")
      .eq("item_id", item.id)
      .eq("location_id", effectiveAreaId)
      .maybeSingle();

    if (invErr) {
      console.error("inventory load error:", invErr);
      setSearching(false);
      return;
    }

    setFoundInventory(inv || null);
    setSearching(false);
  }

  async function ensureInventoryRow(itemId: string, locId: string) {
    const { data: existing, error: exErr } = await supabase
      .from("inventory")
      .select("id,item_id,location_id,on_hand,par_level")
      .eq("item_id", itemId)
      .eq("location_id", locId)
      .maybeSingle();

    if (exErr) throw exErr;
    if (existing) return existing;

    const { data: created, error: cErr } = await supabase
      .from("inventory")
      .insert({ item_id: itemId, location_id: locId, on_hand: 0, par_level: 0 })
      .select("id,item_id,location_id,on_hand,par_level")
      .single();

    if (cErr) throw cErr;
    return created;
  }

  async function applyTransaction(kind: "pull" | "restock") {
    if (!foundItem) return alert("Search an item first.");
    if (!effectiveAreaId) return alert("Pick a location first.");

    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid quantity.");

    try {
      const row = await ensureInventoryRow(foundItem.id, effectiveAreaId);
      const next = kind === "pull" ? row.on_hand - amount : row.on_hand + amount;

      const { data: updated, error } = await supabase
        .from("inventory")
        .update({ on_hand: next })
        .eq("id", row.id)
        .select("id,item_id,location_id,on_hand,par_level")
        .single();

      if (error) throw error;

      setFoundInventory(updated);

      // auto-reset MAIN override after one transaction
      if (mainOverride) setMainOverride(false);

      alert(kind === "pull" ? "Used ✅" : "Restocked ✅");
    } catch (e: any) {
      console.error(e);
      alert(`Transaction failed: ${e?.message || "unknown error"}`);
    }
  }

  async function addNewItemAndPrepare() {
    const name = (newName || query).trim();
    if (!name) return alert("Enter an item name.");

    try {
      const { data: created, error } = await supabase
        .from("items")
        .insert({ name, barcode: newBarcode.trim() ? newBarcode.trim() : null })
        .select("id,name,barcode")
        .single();

      if (error) throw error;

      setFoundItem(created);
      setQuery(created.name);

      if (effectiveAreaId) {
        const row = await ensureInventoryRow(created.id, effectiveAreaId);
        setFoundInventory(row);
      }

      alert("Item added ✅");
    } catch (e: any) {
      console.error(e);
      alert(`Add failed: ${e?.message || "unknown error"}`);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="h1">Baxter<br />ASC<br />Inventory</h1>
            <p className="sub">Cabinet tracking +<br />building totals + low<br />stock alerts</p>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="label" style={{ margin: 0, marginBottom: 8 }}>Location:</div>
            <div className="badge">{currentArea?.name || "—"}</div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <div className="pill">
                <span style={{ fontSize: 18 }}>{locked ? "🔒" : "🔓"}</span>
                <span style={{ fontWeight: 800 }}>{locked ? "Locked" : "Unlocked"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="btnRow">
          <button className={`tab ${tab === "transaction" ? "tabActive" : ""}`} onClick={() => setTab("transaction")}>
            Transaction
          </button>
          <button className={`tab ${tab === "totals" ? "tabActive" : ""}`} onClick={() => setTab("totals")}>
            Totals
          </button>
          <button className={`tab ${tab === "settings" ? "tabActive" : ""}`} onClick={() => setTab("settings")}>
            Settings
          </button>
        </div>
      </div>

      {tab === "transaction" && (
        <>
          <div className="card section">
            <div className="label">Select location</div>
            <select className="select" value={areaId} onChange={(e) => handleChangeArea(e.target.value)} disabled={locked || areas.length === 0}>
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
            <div className="helper">
              {locked ? "Locked: enter PIN in Settings to change location." : "Unlocked: you can change location."}
            </div>
          </div>

          <div className="bigCard">
            <div className="split">
              <div>
                <div className="bigTitle">One-time<br />override</div>
                <div className="sub" style={{ margin: 0 }}>
                  Grabbed it from <b>MAIN</b> supply room? Tap once.
                </div>
              </div>

              <button
                className="actionBtn"
                onClick={() => {
                  if (!mainAreaId) return alert("No MAIN area found. Make sure one storage_areas row includes 'Main' in the name.");
                  setMainOverride((v) => !v);
                }}
              >
                ⚡ {mainOverride ? "MAIN (1x) ✅" : "MAIN (1x)"}
              </button>
            </div>
          </div>

          <div className="card section">
            <div className="label">Find item</div>
            <div className="split">
              <input className="input" placeholder="Scan barcode or type item..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="actionBtn actionBtnPrimary" onClick={runSearch} disabled={searching}>
                {searching ? "..." : "Search"}
              </button>
            </div>

            {foundItem && (
              <>
                <div className="hr" />
                <div style={{ fontSize: 18, fontWeight: 800 }}>{foundItem.name}</div>
                <div className="helper">
                  Location used: <b>{(mainOverride ? "MAIN (1x)" : currentArea?.name) || "—"}</b>
                </div>

                <div className="hr" />

                <div className="label">Quantity</div>
                <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                <div className="helper">
                  On hand: <b>{foundInventory?.on_hand ?? 0}</b> &nbsp;|&nbsp; Par: <b>{foundInventory?.par_level ?? 0}</b>
                </div>

                <div className="btnRow">
                  <button className="tab" onClick={() => applyTransaction("pull")}>Use</button>
                  <button className="tab" onClick={() => applyTransaction("restock")}>Restock</button>
                </div>
              </>
            )}

            {!foundItem && query.trim().length > 0 && !searching && (
              <>
                <div className="hr" />
                <div style={{ fontSize: 18, fontWeight: 800 }}>Not found</div>
                <div className="helper">Add it once, then you can use/restock it.</div>

                <div className="section">
                  <div className="label">New item name</div>
                  <input className="input" placeholder="Item name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>

                <div className="section">
                  <div className="label">Barcode (optional)</div>
                  <input className="input" placeholder="Scan/type barcode (optional)" value={newBarcode} onChange={(e) => setNewBarcode(e.target.value)} />
                </div>

                <div className="btnRow">
                  <button className="tab tabActive" onClick={addNewItemAndPrepare}>Add New Item</button>
                  <button className="tab" onClick={clearTransaction}>Clear</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === "totals" && <TotalsView />}
      {tab === "settings" && (
        <div className="card section">
          <div className="bigTitle" style={{ marginBottom: 10 }}>Settings</div>

          <div className="label">Location Lock PIN</div>
          <div className="helper" style={{ marginTop: -2, marginBottom: 10 }}>
            Enter PIN to unlock location changes.
          </div>

          <div className="split">
            <input className="input" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} style={{ flex: 1 }} />
            <button className="actionBtn actionBtnPrimary" onClick={() => (locked ? unlockIfPinValid() : alert("Already unlocked."))}>
              Unlock
            </button>
          </div>

          <div className="btnRow">
            <button className="tab" onClick={() => setLocked(true)}>Lock</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalsView() {
  const [rows, setRows] = useState<{ area: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: areas, error: aErr } = await supabase
        .from("storage_areas")
        .select("id,name,active");

      if (aErr) {
        console.error(aErr);
        setLoading(false);
        return;
      }

      const activeAreas = (areas || []).filter((r) => r.active !== false);

      const { data: inv, error: iErr } = await supabase
        .from("inventory")
        .select("location_id");

      if (iErr) {
        console.error(iErr);
        setLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      (inv || []).forEach((r) => counts.set(r.location_id, (counts.get(r.location_id) || 0) + 1));

      const out = activeAreas.map((a) => ({
        area: a.name,
        count: counts.get(a.id) || 0,
      }));

      out.sort((x, y) => y.count - x.count);
      setRows(out);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="card section">
      <div className="bigTitle" style={{ marginBottom: 8 }}>Totals</div>
      <div className="helper">Inventory rows per storage area.</div>
      <div className="hr" />
      {loading ? (
        <div className="helper">Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.area} className="pill" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800 }}>{r.area}</span>
              <span style={{ opacity: 0.8 }}>{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
