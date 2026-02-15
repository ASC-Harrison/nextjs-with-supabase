"use client";

import { useEffect, useMemo, useState } from "react";

type StorageArea = { id: string; name: string };
type TotalsRow = {
  item_id: string;
  item_name?: string; // some APIs use item_name
  name?: string;      // some APIs use name
  barcode: string | null;
  total_on_hand: number | null;
};

type TabKey = "transaction" | "totals" | "settings";

function toArray<T>(val: any): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function pickStorageAreas(json: any): StorageArea[] {
  // support: { ok:true, storageAreas: [...] } OR { ok:true, areas:[...] } OR direct array
  const raw =
    json?.storageAreas ??
    json?.areas ??
    json?.rows ??
    json?.data ??
    json;
  return toArray<StorageArea>(raw).filter((x) => x?.id && x?.name);
}

function pickTotals(json: any): TotalsRow[] {
  // support: { ok:true, items:[...] } OR { ok:true, rows:[...] } OR direct array
  const raw =
    json?.items ??
    json?.rows ??
    json?.data ??
    json;
  return toArray<TotalsRow>(raw).filter((x) => x?.item_id);
}

export default function ProtectedPage() {
  const [tab, setTab] = useState<TabKey>("transaction");

  // settings / location
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");

  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");

  // one-time main override
  const [overrideOnce, setOverrideOnce] = useState(false);

  // transaction
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [itemInput, setItemInput] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  // totals
  const [totals, setTotals] = useState<TotalsRow[]>([]);
  const [search, setSearch] = useState("");

  const filteredTotals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return totals;
    return totals.filter((r) => {
      const name = (r.item_name ?? r.name ?? "").toLowerCase();
      const bc = (r.barcode ?? "").toLowerCase();
      return name.includes(q) || bc.includes(q);
    });
  }, [totals, search]);

  // MAIN id (best-effort by name)
  const mainId = useMemo(() => {
    const main = storageAreas.find((a) =>
      a.name.toLowerCase().includes("main")
    );
    return main?.id ?? null;
  }, [storageAreas]);

  async function loadStorageAreas() {
    try {
      const res = await fetch("/api/storage-areas", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const list = pickStorageAreas(json);

      setStorageAreas(list);

      // ensure a valid default location id
      if (!defaultLocationId && list.length > 0) {
        setDefaultLocationId(list[0].id);
      } else if (defaultLocationId && list.length > 0) {
        const exists = list.some((x) => x.id === defaultLocationId);
        if (!exists) setDefaultLocationId(list[0].id);
      }
    } catch (e: any) {
      setStorageAreas([]);
      setStatus(`Error loading storage areas`);
    }
  }

  async function loadTotals() {
    try {
      const res = await fetch("/api/items?totals=1", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const list = pickTotals(json);
      setTotals(list);
    } catch (e: any) {
      setTotals([]);
      setStatus(`Error loading totals`);
    }
  }

  useEffect(() => {
    loadStorageAreas();
    loadTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock() {
    try {
      setStatus("Unlocking...");
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setStatus(`Unlock failed: ${json?.error ?? res.status}`);
        return;
      }
      setLocked(false);
      setPin("");
      setStatus("Unlocked");
    } catch {
      setStatus("Unlock failed");
    }
  }

  async function lock() {
    setLocked(true);
    setOverrideOnce(false);
    setStatus("Locked");
    try {
      await fetch("/api/lock", { method: "POST" });
    } catch {}
  }

  async function submit() {
    const cleanItem = itemInput.trim();
    const cleanQty = Math.max(1, Number(qty) || 1);

    if (!defaultLocationId) {
      setStatus("Transaction failed: Missing location (pick a location first)");
      return;
    }
    if (!cleanItem) {
      setStatus("Type an item name or barcode");
      return;
    }

    // choose location for this submit
    const submitLocationId = overrideOnce && mainId ? mainId : defaultLocationId;

    setBusy(true);
    setStatus("Submitting...");

    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          qty: cleanQty,
          itemOrBarcode: cleanItem, // ✅ matches what you used earlier in your working build
          location_id: submitLocationId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setStatus(`Transaction failed: ${json?.error ?? res.status}`);
        return;
      }

      setStatus("✅ Submitted");
      setItemInput("");
      setQty(1);

      if (overrideOnce) setOverrideOnce(false);

      await loadTotals();
    } catch {
      setStatus("Transaction failed (network)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Live Inventory
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
              Baxter ASC Inventory
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Cabinet tracking + building totals + low stock alerts
            </p>
            <p className="mt-1 text-xs text-neutral-500">{status}</p>
          </div>

          <button
            onClick={loadTotals}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99]"
          >
            Refresh
          </button>
        </div>

        {/* MOBILE TABS */}
        <div className="mt-5 sm:hidden">
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <TabButton active={tab === "transaction"} onClick={() => setTab("transaction")}>
              Transaction
            </TabButton>
            <TabButton active={tab === "totals"} onClick={() => setTab("totals")}>
              Totals
            </TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              Settings
            </TabButton>
          </div>
        </div>

        {/* DESKTOP: Settings left, Transaction+Totals right */}
        <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-2">
          <SettingsCard
            locked={locked}
            pin={pin}
            setPin={setPin}
            unlock={unlock}
            lock={lock}
            storageAreas={storageAreas}
            defaultLocationId={defaultLocationId}
            setDefaultLocationId={setDefaultLocationId}
            canChangeLocation={!locked}
            overrideOnce={overrideOnce}
            setOverrideOnce={setOverrideOnce}
          />

          <div className="space-y-4">
            <TransactionCard
              mode={mode}
              setMode={setMode}
              itemInput={itemInput}
              setItemInput={setItemInput}
              qty={qty}
              setQty={setQty}
              submit={submit}
              busy={busy}
            />
            <TotalsCard
              search={search}
              setSearch={setSearch}
              items={filteredTotals}
            />
          </div>
        </div>

        {/* MOBILE TAB PANELS */}
        <div className="mt-4 space-y-4 sm:hidden">
          {tab === "transaction" && (
            <TransactionCard
              mode={mode}
              setMode={setMode}
              itemInput={itemInput}
              setItemInput={setItemInput}
              qty={qty}
              setQty={setQty}
              submit={submit}
              busy={busy}
            />
          )}

          {tab === "totals" && (
            <TotalsCard search={search} setSearch={setSearch} items={filteredTotals} />
          )}

          {tab === "settings" && (
            <SettingsCard
              locked={locked}
              pin={pin}
              setPin={setPin}
              unlock={unlock}
              lock={lock}
              storageAreas={storageAreas}
              defaultLocationId={defaultLocationId}
              setDefaultLocationId={setDefaultLocationId}
              canChangeLocation={!locked}
              overrideOnce={overrideOnce}
              setOverrideOnce={setOverrideOnce}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-3 text-sm font-semibold",
        active ? "bg-black text-white" : "bg-white text-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-extrabold text-neutral-900">{title}</div>
      {children}
    </div>
  );
}

function SettingsCard(props: {
  locked: boolean;
  pin: string;
  setPin: (v: string) => void;
  unlock: () => void;
  lock: () => void;
  storageAreas: StorageArea[];
  defaultLocationId: string;
  setDefaultLocationId: (v: string) => void;
  canChangeLocation: boolean;
  overrideOnce: boolean;
  setOverrideOnce: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Card title={props.locked ? "Location Locked" : "Location Unlocked"}>
        <div className="flex items-center gap-2">
          <input
            value={props.pin}
            onChange={(e) => props.setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <button
            onClick={props.unlock}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Unlock
          </button>
          <button
            onClick={props.lock}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Lock
          </button>
        </div>

        <div className="mt-2 text-xs text-neutral-600">
          Unlock lets you change the default location.
        </div>
      </Card>

      <Card title="Default location (stays set)">
        <select
          value={props.defaultLocationId}
          disabled={!props.canChangeLocation}
          onChange={(e) => props.setDefaultLocationId(e.target.value)}
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {props.storageAreas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div className="mt-3 rounded-xl border bg-neutral-50 p-3">
          <div className="text-sm font-bold">One-time override</div>
          <div className="mt-1 text-xs text-neutral-600">
            Use Main Supply once (doesn’t change your default).
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => props.setOverrideOnce(true)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-extrabold shadow-sm",
                props.overrideOnce ? "bg-blue-600 text-white" : "bg-white border",
              ].join(" ")}
            >
              ⚡ MAIN (1x)
            </button>
            <button
              onClick={() => props.setOverrideOnce(false)}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm"
            >
              Cancel
            </button>
          </div>

          {props.overrideOnce && (
            <div className="mt-2 text-xs font-semibold text-blue-700">
              Next submit pulls from Main (by name match).
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function TransactionCard(props: {
  mode: "USE" | "RESTOCK";
  setMode: (m: "USE" | "RESTOCK") => void;
  itemInput: string;
  setItemInput: (v: string) => void;
  qty: number;
  setQty: (n: number) => void;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <Card title="Transaction">
      <div className="flex gap-2">
        <button
          onClick={() => props.setMode("USE")}
          className={[
            "flex-1 rounded-2xl border px-4 py-3 text-sm font-extrabold shadow-sm",
            props.mode === "USE" ? "bg-red-600 text-white border-red-600" : "bg-white",
          ].join(" ")}
        >
          ⛔ USE
        </button>
        <button
          onClick={() => props.setMode("RESTOCK")}
          className={[
            "flex-1 rounded-2xl border px-4 py-3 text-sm font-extrabold shadow-sm",
            props.mode === "RESTOCK" ? "bg-green-700 text-white border-green-700" : "bg-white",
          ].join(" ")}
        >
          ➕ RESTOCK
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <input
          value={props.itemInput}
          onChange={(e) => props.setItemInput(e.target.value)}
          placeholder="Type item name or barcode..."
          className="w-full rounded-xl border px-3 py-3 text-sm"
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => props.setQty(Math.max(1, Number(props.qty) - 1))}
            className="rounded-xl border bg-white py-3 text-lg font-extrabold"
          >
            −
          </button>
          <input
            value={props.qty}
            onChange={(e) => props.setQty(Math.max(1, Number(e.target.value || 1)))}
            inputMode="numeric"
            className="rounded-xl border px-3 py-3 text-center text-sm font-bold"
          />
          <button
            onClick={() => props.setQty(Number(props.qty) + 1)}
            className="rounded-xl border bg-white py-3 text-lg font-extrabold"
          >
            +
          </button>
        </div>

        <button
          onClick={props.submit}
          disabled={props.busy}
          className="w-full rounded-2xl bg-black px-4 py-4 text-sm font-extrabold text-white shadow-sm disabled:opacity-60"
        >
          ✅ Submit {props.mode}
        </button>
      </div>
    </Card>
  );
}

function TotalsCard(props: {
  search: string;
  setSearch: (v: string) => void;
  items: TotalsRow[];
}) {
  return (
    <Card title="Total Inventory (All Locations)">
      <input
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        placeholder="Search item or barcode..."
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <div className="mt-3 space-y-2">
        {props.items.slice(0, 30).map((it) => {
          const displayName = it.item_name ?? it.name ?? "Unnamed Item";
          const count = typeof it.total_on_hand === "number" ? it.total_on_hand : 0;

          return (
            <div
              key={it.item_id}
              className="flex items-center justify-between rounded-xl border bg-white px-3 py-3"
            >
              <div>
                <div className="text-sm font-extrabold">{displayName}</div>
                <div className="text-xs text-neutral-600">{it.barcode ?? ""}</div>
              </div>
              <div className="rounded-full bg-black px-3 py-1 text-sm font-extrabold text-white">
                {count}
              </div>
            </div>
          );
        })}

        {props.items.length === 0 && (
          <div className="text-sm text-neutral-600">No totals returned yet.</div>
        )}

        {props.items.length > 30 && (
          <div className="text-xs text-neutral-500">
            Showing first 30. Use search to narrow.
          </div>
        )}
      </div>
    </Card>
  );
}
