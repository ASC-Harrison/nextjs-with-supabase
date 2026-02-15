"use client";

import { useEffect, useMemo, useState } from "react";

type StorageArea = { id: string; name: string };
type ItemRow = { id: string; name: string; barcode: string | null; total_on_hand?: number };

type TabKey = "transaction" | "totals" | "settings";

export default function ProtectedPage() {
  const [tab, setTab] = useState<TabKey>("transaction");

  // lock + location
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");

  // one-time override (MAIN 1x)
  const [overrideOnce, setOverrideOnce] = useState(false);

  // transaction
  const [mode, setMode] = useState<"USE" | "RESTOCK">("USE");
  const [qty, setQty] = useState<number>(1);
  const [itemInput, setItemInput] = useState("");
  const [status, setStatus] = useState<string>("Ready");

  // totals list
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState<ItemRow[]>([]);
  const filteredTotals = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return totals;
    return totals.filter((x) => {
      const n = (x.name ?? "").toLowerCase();
      const b = (x.barcode ?? "").toLowerCase();
      return n.includes(s) || b.includes(s);
    });
  }, [search, totals]);

  // ---------- load initial ----------
  useEffect(() => {
    (async () => {
      await loadStorageAreas();
      await loadTotals();
    })();
  }, []);

  async function loadStorageAreas() {
    try {
      const res = await fetch("/api/storage-areas", { cache: "no-store" });
      if (!res.ok) throw new Error(`storage-areas ${res.status}`);
      const data = await res.json();
      const list: StorageArea[] = data.storageAreas ?? data ?? [];
      setStorageAreas(list);

      // set first default if none chosen yet
      if (!defaultLocationId && list?.length) {
        setDefaultLocationId(list[0].id);
      }
    } catch (e: any) {
      setStatus(`Error loading locations: ${e.message ?? e}`);
    }
  }

  async function loadTotals() {
    try {
      const res = await fetch("/api/items?totals=1", { cache: "no-store" });
      if (!res.ok) throw new Error(`items ${res.status}`);
      const data = await res.json();
      // support different shapes
      const list: ItemRow[] = data.items ?? data ?? [];
      setTotals(list);
    } catch (e: any) {
      setStatus(`Error loading totals: ${e.message ?? e}`);
    }
  }

  // ---------- lock/unlock ----------
  async function unlock() {
    try {
      setStatus("Unlocking...");
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error ?? `Unlock failed (${res.status})`);
      }
      setLocked(false);
      setPin("");
      setStatus("Unlocked");
    } catch (e: any) {
      setStatus(e.message ?? "Unlock failed");
    }
  }

  async function lock() {
    try {
      setStatus("Locking...");
      const res = await fetch("/api/lock", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error ?? `Lock failed (${res.status})`);
      }
      setLocked(true);
      setOverrideOnce(false);
      setStatus("Locked");
    } catch (e: any) {
      setStatus(e.message ?? "Lock failed");
    }
  }

  // ---------- submit transaction ----------
  async function submit() {
    try {
      setStatus("Submitting...");

      // pick location:
      // - if overrideOnce: use "Main Sterile Supply" by name if exists, else defaultLocationId
      // - else: use defaultLocationId
      let locationId = defaultLocationId;

      if (overrideOnce) {
        const main = storageAreas.find((x) =>
          x.name.toLowerCase().includes("main sterile")
        );
        if (main?.id) locationId = main.id;
      }

      if (!locationId) throw new Error("Missing location");

      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          location_id: locationId,
          item: itemInput, // name or barcode
          qty: Number(qty),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }

      setStatus("✅ Submitted");
      setItemInput("");
      setQty(1);

      // reset one-time override after use
      if (overrideOnce) setOverrideOnce(false);

      // refresh totals so you see updates immediately
      await loadTotals();
    } catch (e: any) {
      setStatus(`Transaction failed: ${e.message ?? e}`);
    }
  }

  // ---------- UI helpers ----------
  const canChangeLocation = !locked;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* Header */}
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
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadTotals}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99]"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* PHONE TABS (this is the “tab option”) */}
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

        {/* DESKTOP LAYOUT */}
        <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-2">
          <SettingsCard
            locked={locked}
            pin={pin}
            setPin={setPin}
            unlock={unlock}
            lock={lock}
            status={status}
            storageAreas={storageAreas}
            defaultLocationId={defaultLocationId}
            setDefaultLocationId={setDefaultLocationId}
            canChangeLocation={canChangeLocation}
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
              status={status}
            />
            <TotalsCard
              search={search}
              setSearch={setSearch}
              items={filteredTotals}
            />
          </div>
        </div>

        {/* MOBILE TABBED PANELS */}
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
              status={status}
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
              status={status}
              storageAreas={storageAreas}
              defaultLocationId={defaultLocationId}
              setDefaultLocationId={setDefaultLocationId}
              canChangeLocation={canChangeLocation}
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
  status: string;
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
            If your default is a cabinet but you grabbed something from Main Supply once.
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
              Source for next submit: Main Sterile Supply
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-neutral-600">Status: {props.status}</div>
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
  status: string;
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
          className="w-full rounded-2xl bg-black px-4 py-4 text-sm font-extrabold text-white shadow-sm"
        >
          ✅ Submit {props.mode}
        </button>

        <div className="text-xs text-neutral-600">{props.status}</div>
      </div>
    </Card>
  );
}

function TotalsCard(props: {
  search: string;
  setSearch: (v: string) => void;
  items: ItemRow[];
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
        {props.items.slice(0, 30).map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between rounded-xl border bg-white px-3 py-3"
          >
            <div>
              <div className="text-sm font-extrabold">{it.name}</div>
              <div className="text-xs text-neutral-600">{it.barcode ?? ""}</div>
            </div>
            <div className="rounded-full bg-black px-3 py-1 text-sm font-extrabold text-white">
              {typeof it.total_on_hand === "number" ? it.total_on_hand : "—"}
            </div>
          </div>
        ))}

        {props.items.length > 30 && (
          <div className="text-xs text-neutral-500">
            Showing first 30 results. Use search to narrow down.
          </div>
        )}
      </div>
    </Card>
  );
}
