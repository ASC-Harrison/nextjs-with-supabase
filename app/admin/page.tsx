"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const LS_PIN = "ASC_ADMIN_PIN";
const LS_UNLOCK = "ASC_ADMIN_UNLOCKED";

type AdminTab = "inventory" | "prefcards";

type Row = {
  storage_area_id: string;
  item_id: string;
  on_hand: number | null;
  par_level: number | null;
  low?: boolean | null;
  low_notified?: boolean | null;
  updated_at?: string | null;
  storage_areas?: { name?: string | null } | null;
  items?: {
    name?: string | null;
    barcode?: string | null;
    vendor?: string | null;
    category?: string | null;
  } | null;
};

type PrefCard = {
  id: string;
  surgeon: string;
  procedure_name: string;
  specialty: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type ItemSearchRow = {
  id: string;
  name: string | null;
  barcode: string | null;
  vendor: string | null;
  category: string | null;
  reference_number?: string | null;
  unit?: string | null;
};

type PrefCardItem = {
  id: string;
  pref_card_id: string;
  item_id: string;
  qty: number;
  status: "OPEN" | "HOLD" | "PRN";
  notes: string | null;
  sort_order: number;
  items?: ItemSearchRow | ItemSearchRow[] | null;
};

function oneItem(
  x?: ItemSearchRow | ItemSearchRow[] | null
): ItemSearchRow | null {
  if (!x) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/12 text-amber-100 ring-amber-300/25"
      : tone === "bad"
      ? "bg-rose-500/12 text-rose-200 ring-rose-300/25"
      : "bg-white/5 text-white/75 ring-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm font-extrabold transition",
        "ring-1 ring-white/10 bg-white/5 hover:bg-white/10",
        active && "bg-white text-black ring-white/40 hover:bg-white")
      }
    >
      {children}
    </button>
  );
}

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-500/8 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/8 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/8 ring-rose-400/20"
      : "bg-white/5 ring-white/10";

  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-2 ring-1",
        "shadow-[0_12px_40px_rgba(0,0,0,0.25)]",
        toneCls
      )}
    >
      <div className="text-[10px] tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-white/90 tabular-nums">
        {value}
      </div>
    </div>
  );
}

type ApiResp = {
  ok: boolean;
  rows?: Row[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("inventory");

  const [locked, setLocked] = useState(true);
  const [pinEntry, setPinEntry] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const dq = useDebounced(q, 300);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [prefCards, setPrefCards] = useState<PrefCard[]>([]);
  const [prefCardsLoading, setPrefCardsLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [prefItems, setPrefItems] = useState<PrefCardItem[]>([]);
  const [prefItemsLoading, setPrefItemsLoading] = useState(false);
  const [savingPrefKey, setSavingPrefKey] = useState<string | null>(null);

  const [surgeonInput, setSurgeonInput] = useState("");
  const [procedureInput, setProcedureInput] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [prefNotesInput, setPrefNotesInput] = useState("");

  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<ItemSearchRow[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const dItemSearch = useDebounced(itemSearch, 250);

  const inventoryStats = useMemo(() => {
    const total = rows.length;
    const low = rows.filter((r) => r.low).length;
    const notified = rows.filter((r) => r.low_notified).length;
    return { total, low, notified };
  }, [rows]);

  const selectedPrefCard = useMemo(
    () => prefCards.find((c) => c.id === selectedCardId) || null,
    [prefCards, selectedCardId]
  );

  const prefStats = useMemo(() => {
    const totalCards = prefCards.length;
    const activeCards = prefCards.filter((c) => c.is_active).length;
    const itemCount = prefItems.length;
    return { totalCards, activeCards, itemCount };
  }, [prefCards, prefItems]);

  const openItems = useMemo(
    () => prefItems.filter((x) => x.status === "OPEN"),
    [prefItems]
  );
  const holdItems = useMemo(
    () => prefItems.filter((x) => x.status === "HOLD"),
    [prefItems]
  );
  const prnItems = useMemo(
    () => prefItems.filter((x) => x.status === "PRN"),
    [prefItems]
  );

  useEffect(() => {
    try {
      const unlocked = localStorage.getItem(LS_UNLOCK) === "true";
      setLocked(!unlocked);
    } catch {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function openPinAndUnlock() {
    const stored = localStorage.getItem(LS_PIN) || "";
    if (!stored) {
      setToast("No admin PIN set yet. Set it first in your PIN settings flow.");
      return;
    }
    if (pinEntry.trim() === stored.trim()) {
      localStorage.setItem(LS_UNLOCK, "true");
      setLocked(false);
      setPinEntry("");
      setToast("Unlocked ✅");
    } else {
      setToast("Wrong PIN");
    }
  }

  function lockNow() {
    localStorage.setItem(LS_UNLOCK, "false");
    setLocked(true);
    setToast("Locked 🔒");
  }

  async function loadFirstPage() {
    setLoading(true);
    setToast(null);
    setCursor(null);
    setHasMore(true);
    setRows([]);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const params = new URLSearchParams();
    if (dq.trim()) params.set("q", dq.trim());
    if (onlyLow) params.set("onlyLow", "1");
    params.set("limit", "200");

    const res = await fetch(`/api/admin-inventory?${params.toString()}`, {
      signal: ac.signal,
    });
    const json = (await res.json()) as ApiResp;

    if (!json.ok) {
      setToast(`Load failed: ${json.error || "unknown error"}`);
      setLoading(false);
      return;
    }

    setRows(json.rows || []);
    setCursor(json.nextCursor || null);
    setHasMore(Boolean(json.hasMore));
    setLoading(false);
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !cursor) return;

    setLoadingMore(true);
    setToast(null);

    const params = new URLSearchParams();
    if (dq.trim()) params.set("q", dq.trim());
    if (onlyLow) params.set("onlyLow", "1");
    params.set("limit", "200");
    params.set("cursor", cursor);

    const res = await fetch(`/api/admin-inventory?${params.toString()}`);
    const json = (await res.json()) as ApiResp;

    if (!json.ok) {
      setToast(`Load failed: ${json.error || "unknown error"}`);
      setLoadingMore(false);
      return;
    }

    const incoming = json.rows || [];
    const seen = new Set(rows.map((r) => `${r.storage_area_id}:${r.item_id}`));
    const merged = [...rows];
    for (const r of incoming) {
      const key = `${r.storage_area_id}:${r.item_id}`;
      if (!seen.has(key)) merged.push(r);
    }

    setRows(merged);
    setCursor(json.nextCursor || null);
    setHasMore(Boolean(json.hasMore));
    setLoadingMore(false);
  }

  useEffect(() => {
    if (tab !== "inventory") return;
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, onlyLow, tab]);

  useEffect(() => {
    if (tab !== "inventory") return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "900px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, hasMore, loadingMore, dq, onlyLow, tab]);

  async function saveCell(r: Row, field: "on_hand" | "par_level", value: string) {
    if (locked) {
      setToast("PIN required");
      return;
    }

    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      setToast("Enter a valid number");
      return;
    }

    const rowKey = `${r.storage_area_id}:${r.item_id}`;
    const key = `${rowKey}:${field}`;
    setSavingKey(key);

    const patch: Partial<Row> = { [field]: num } as any;

    const { error } = await supabase
      .from("storage_inventory")
      .update(patch)
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      setSavingKey(null);
      return;
    }

    setRows((prev) =>
      prev.map((x) =>
        x.storage_area_id === r.storage_area_id && x.item_id === r.item_id
          ? { ...x, ...patch }
          : x
      )
    );

    setSavingKey(null);
    setToast("Saved ✅");
  }

  async function loadPrefCards() {
    setPrefCardsLoading(true);

    const { data, error } = await supabase
      .from("pref_cards")
      .select("*")
      .order("surgeon", { ascending: true })
      .order("procedure_name", { ascending: true });

    if (error) {
      setToast(`Pref cards load failed: ${error.message}`);
      setPrefCardsLoading(false);
      return;
    }

    const cards = (data || []) as PrefCard[];
    setPrefCards(cards);

    if (!selectedCardId && cards.length > 0) {
      setSelectedCardId(cards[0].id);
    } else if (selectedCardId && !cards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(cards[0]?.id || "");
    }

    setPrefCardsLoading(false);
  }

  async function loadPrefItems(cardId: string) {
    if (!cardId) {
      setPrefItems([]);
      return;
    }

    setPrefItemsLoading(true);

    const { data, error } = await supabase
      .from("pref_card_items")
      .select(
        "id,pref_card_id,item_id,qty,status,notes,sort_order,items(id,name,barcode,vendor,category,reference_number,unit)"
      )
      .eq("pref_card_id", cardId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setToast(`Pref card items load failed: ${error.message}`);
      setPrefItemsLoading(false);
      return;
    }

    const normalized: PrefCardItem[] = (data || []).map((row: any) => ({
      id: row.id,
      pref_card_id: row.pref_card_id,
      item_id: row.item_id,
      qty: row.qty,
      status: row.status,
      notes: row.notes,
      sort_order: row.sort_order,
      items: oneItem(row.items),
    }));

    setPrefItems(normalized);
    setPrefItemsLoading(false);
  }

  useEffect(() => {
    if (tab !== "prefcards") return;
    loadPrefCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "prefcards") return;
    loadPrefItems(selectedCardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, tab]);

  useEffect(() => {
    if (tab !== "prefcards") return;
    const q = dItemSearch.trim();
    if (!q || q.length < 2) {
      setItemResults([]);
      setItemSearchLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      setItemSearchLoading(true);

      const { data, error } = await supabase
        .from("items")
        .select("id,name,barcode,vendor,category,reference_number,unit")
        .or(
          `name.ilike.%${q}%,barcode.ilike.%${q}%,reference_number.ilike.%${q}%,vendor.ilike.%${q}%`
        )
        .order("name", { ascending: true })
        .limit(12);

      if (!alive) return;

      if (error) {
        setToast(`Item search failed: ${error.message}`);
        setItemResults([]);
        setItemSearchLoading(false);
        return;
      }

      setItemResults((data || []) as ItemSearchRow[]);
      setItemSearchLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [dItemSearch, tab]);

  async function createPrefCard() {
    if (locked) {
      setToast("PIN required");
      return;
    }
    if (!surgeonInput.trim()) {
      setToast("Enter surgeon");
      return;
    }
    if (!procedureInput.trim()) {
      setToast("Enter procedure");
      return;
    }

    const payload = {
      surgeon: surgeonInput.trim(),
      procedure_name: procedureInput.trim(),
      specialty: specialtyInput.trim() || null,
      notes: prefNotesInput.trim() || null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from("pref_cards")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setToast(`Create failed: ${error.message}`);
      return;
    }

    const newCard = data as PrefCard;
    setSurgeonInput("");
    setProcedureInput("");
    setSpecialtyInput("");
    setPrefNotesInput("");
    setToast("Pref card created ✅");

    await loadPrefCards();
    setSelectedCardId(newCard.id);
  }

  async function savePrefCardHeader() {
    if (locked) {
      setToast("PIN required");
      return;
    }
    if (!selectedPrefCard) return;

    const payload = {
      surgeon: surgeonInput.trim(),
      procedure_name: procedureInput.trim(),
      specialty: specialtyInput.trim() || null,
      notes: prefNotesInput.trim() || null,
    };

    const { error } = await supabase
      .from("pref_cards")
      .update(payload)
      .eq("id", selectedPrefCard.id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      return;
    }

    setToast("Pref card saved ✅");
    await loadPrefCards();
  }

  async function togglePrefCardActive() {
    if (locked) {
      setToast("PIN required");
      return;
    }
    if (!selectedPrefCard) return;

    const { error } = await supabase
      .from("pref_cards")
      .update({ is_active: !selectedPrefCard.is_active })
      .eq("id", selectedPrefCard.id);

    if (error) {
      setToast(`Update failed: ${error.message}`);
      return;
    }

    setToast(selectedPrefCard.is_active ? "Moved inactive" : "Restored active");
    await loadPrefCards();
  }

  async function deletePrefCard() {
    if (locked) {
      setToast("PIN required");
      return;
    }
    if (!selectedPrefCard) return;

    const ok = confirm(
      `Delete pref card?\n\n${selectedPrefCard.surgeon} — ${selectedPrefCard.procedure_name}\n\nThis deletes all pref card items too.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from("pref_cards")
      .delete()
      .eq("id", selectedPrefCard.id);

    if (error) {
      setToast(`Delete failed: ${error.message}`);
      return;
    }

    setToast("Pref card deleted");
    setSelectedCardId("");
    setPrefItems([]);
    await loadPrefCards();
  }

  function startEditingCard(card: PrefCard) {
    setSelectedCardId(card.id);
    setSurgeonInput(card.surgeon || "");
    setProcedureInput(card.procedure_name || "");
    setSpecialtyInput(card.specialty || "");
    setPrefNotesInput(card.notes || "");
  }

  useEffect(() => {
    if (!selectedPrefCard) return;
    setSurgeonInput(selectedPrefCard.surgeon || "");
    setProcedureInput(selectedPrefCard.procedure_name || "");
    setSpecialtyInput(selectedPrefCard.specialty || "");
    setPrefNotesInput(selectedPrefCard.notes || "");
  }, [selectedPrefCard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addItemToPrefCard(itemRow: ItemSearchRow) {
    if (locked) {
      setToast("PIN required");
      return;
    }
    if (!selectedCardId) {
      setToast("Select a pref card first");
      return;
    }

    const nextSort =
      prefItems.length > 0
        ? Math.max(...prefItems.map((x) => x.sort_order ?? 0)) + 1
        : 1;

    const { data, error } = await supabase
      .from("pref_card_items")
      .insert({
        pref_card_id: selectedCardId,
        item_id: itemRow.id,
        qty: 1,
        status: "OPEN",
        notes: null,
        sort_order: nextSort,
      })
      .select(
        "id,pref_card_id,item_id,qty,status,notes,sort_order,items(id,name,barcode,vendor,category,reference_number,unit)"
      )
      .single();

    if (error) {
      setToast(`Add item failed: ${error.message}`);
      return;
    }

    const normalized: PrefCardItem = {
      id: data.id,
      pref_card_id: data.pref_card_id,
      item_id: data.item_id,
      qty: data.qty,
      status: data.status,
      notes: data.notes,
      sort_order: data.sort_order,
      items: oneItem((data as any).items),
    };

    setPrefItems((prev) => [...prev, normalized]);
    setItemSearch("");
    setItemResults([]);
    setToast("Item added ✅");
  }

  async function savePrefItem(
    row: PrefCardItem,
    field: "qty" | "status" | "notes" | "sort_order",
    value: string
  ) {
    if (locked) {
      setToast("PIN required");
      return;
    }

    let patch: Partial<PrefCardItem> = {};

    if (field === "qty" || field === "sort_order") {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        setToast("Enter a valid number");
        return;
      }
      patch = { [field]: num } as any;
    } else if (field === "status") {
      if (value !== "OPEN" && value !== "HOLD" && value !== "PRN") {
        setToast("Invalid status");
        return;
      }
      patch = { status: value as "OPEN" | "HOLD" | "PRN" };
    } else {
      patch = { notes: value || null };
    }

    const key = `${row.id}:${field}`;
    setSavingPrefKey(key);

    const { error } = await supabase
      .from("pref_card_items")
      .update(patch)
      .eq("id", row.id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      setSavingPrefKey(null);
      return;
    }

    setPrefItems((prev) =>
      prev
        .map((x) => (x.id === row.id ? { ...x, ...patch } : x))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    setSavingPrefKey(null);
    setToast("Saved ✅");
  }

  async function removePrefItem(row: PrefCardItem) {
    if (locked) {
      setToast("PIN required");
      return;
    }

    const ok = confirm(`Remove "${oneItem(row.items)?.name || "item"}" from this pref card?`);
    if (!ok) return;

    const { error } = await supabase
      .from("pref_card_items")
      .delete()
      .eq("id", row.id);

    if (error) {
      setToast(`Remove failed: ${error.message}`);
      return;
    }

    setPrefItems((prev) => prev.filter((x) => x.id !== row.id));
    setToast("Item removed");
  }

  function printPrefCard() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-80 w-[980px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.25em] text-white/45">
                BAXTER ASC • ADMIN CONSOLE
              </div>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight">
                Admin Center <span className="text-white/55">(Inventory + Pref Cards)</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Manage inventory and build surgeon procedure pref cards from your current items list.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                <Link
                  href="/"
                  className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
                >
                  Home
                </Link>
                <Link
                  href="/inventory"
                  className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
                >
                  App
                </Link>
                <IconButton onClick={lockNow} active={locked === true}>
                  {locked ? "🔒 Locked" : "Lock"}
                </IconButton>
              </div>

              <div className="grid grid-cols-4 gap-2 w-full md:w-auto">
                <StatChip label="STATE" value={locked ? "LOCKED" : "OPEN"} tone={locked ? "bad" : "good"} />
                {tab === "inventory" ? (
                  <>
                    <StatChip label="ROWS" value={inventoryStats.total} />
                    <StatChip label="LOW" value={inventoryStats.low} tone={inventoryStats.low ? "warn" : "neutral"} />
                    <StatChip
                      label="NOTIFIED"
                      value={inventoryStats.notified}
                      tone={inventoryStats.notified ? "warn" : "neutral"}
                    />
                  </>
                ) : (
                  <>
                    <StatChip label="CARDS" value={prefStats.totalCards} />
                    <StatChip
                      label="ACTIVE"
                      value={prefStats.activeCards}
                      tone={prefStats.activeCards ? "good" : "neutral"}
                    />
                    <StatChip label="ITEMS" value={prefStats.itemCount} />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <IconButton onClick={() => setTab("inventory")} active={tab === "inventory"}>
                Inventory Table
              </IconButton>
              <IconButton onClick={() => setTab("prefcards")} active={tab === "prefcards"}>
                Pref Cards
              </IconButton>
            </div>

            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <input
                inputMode="numeric"
                value={pinEntry}
                onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter admin PIN"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30 md:w-48"
              />
              <button
                type="button"
                onClick={openPinAndUnlock}
                className="whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {tab === "inventory" ? (
          <>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                <div className="relative w-full md:max-w-xl">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search item, area, barcode, vendor, category…"
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyLow((v) => !v)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition",
                    onlyLow
                      ? "bg-amber-400/20 text-amber-100 ring-amber-300/30"
                      : "bg-white/5 text-white/80 ring-white/10 hover:bg-white/10"
                  )}
                >
                  {onlyLow ? "Showing: LOW" : "Filter: LOW only"}
                </button>

                <button
                  type="button"
                  onClick={loadFirstPage}
                  className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10 hover:bg-white/10"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ring-1 ring-white/5">
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="sticky top-0 z-20 grid grid-cols-12 gap-0 border-b border-white/10 bg-black/70 px-4 py-3 text-xs font-semibold tracking-wider text-white/55">
                    <div className="col-span-3 sticky left-0 z-30 bg-black/70 pr-2">AREA</div>
                    <div className="col-span-4 sticky left-[240px] z-30 bg-black/70 pr-2">ITEM</div>
                    <div className="col-span-2">BARCODE</div>
                    <div className="col-span-1 text-center">ON HAND</div>
                    <div className="col-span-1 text-center">PAR</div>
                    <div className="col-span-1 sticky right-0 z-30 bg-black/70 text-right pl-2">STATUS</div>
                  </div>

                  {loading ? (
                    <div className="p-6 text-white/60">Loading…</div>
                  ) : rows.length === 0 ? (
                    <div className="p-6 text-white/60">No results.</div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {rows.map((r) => {
                        const areaName = r.storage_areas?.name || "(unknown area)";
                        const itemName = r.items?.name || "(unknown item)";
                        const barcode = r.items?.barcode || "";
                        const statusTone = r.low ? "warn" : "good";
                        const rowKey = `${r.storage_area_id}:${r.item_id}`;

                        const onHandKey = `${rowKey}:on_hand`;
                        const parKey = `${rowKey}:par_level`;

                        return (
                          <div
                            key={rowKey}
                            className={cn(
                              "grid grid-cols-12 items-center gap-0 px-4 py-3 transition",
                              r.low ? "bg-amber-500/8 hover:bg-amber-500/14" : "hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="col-span-3 sticky left-0 z-10 bg-black/60 pr-2">
                              <div className="text-sm font-extrabold text-white/90">{areaName}</div>
                              <div className="mt-0.5 text-xs text-white/45">
                                {r.items?.vendor ? r.items.vendor : r.items?.category ? r.items.category : ""}
                              </div>
                            </div>

                            <div className="col-span-4 sticky left-[240px] z-10 bg-black/60 pr-2 min-w-0">
                              <div className="text-sm font-extrabold truncate">{itemName}</div>
                              <div className="mt-0.5 text-xs text-white/45">
                                {r.items?.category ? `Category: ${r.items.category}` : ""}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <div className="text-sm text-white/80 break-all">{barcode || "—"}</div>
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <input
                                disabled={locked}
                                defaultValue={String(r.on_hand ?? 0)}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                                className={cn(
                                  "w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums",
                                  "ring-1 ring-white/10 outline-none focus:ring-white/30",
                                  locked && "opacity-60"
                                )}
                              />
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <input
                                disabled={locked}
                                defaultValue={String(r.par_level ?? 0)}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                                className={cn(
                                  "w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums",
                                  "ring-1 ring-white/10 outline-none focus:ring-white/30",
                                  locked && "opacity-60"
                                )}
                              />
                            </div>

                            <div className="col-span-1 sticky right-0 z-10 bg-black/60 pl-2 flex justify-end">
                              <div className="flex items-center gap-2">
                                {(savingKey === onHandKey || savingKey === parKey) && (
                                  <Pill tone="neutral">Saving…</Pill>
                                )}
                                <Pill tone={statusTone as any}>{r.low ? "LOW" : "OK"}</Pill>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div ref={sentinelRef} className="h-10" />

                  {rows.length > 0 && (
                    <div className="px-4 py-4 text-sm text-white/55">
                      {loadingMore ? "Loading more…" : hasMore ? "Scroll to load more…" : "End of results."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
                <div className="text-lg font-extrabold">Create Pref Card</div>
                <div className="mt-3 space-y-2">
                  <input
                    value={surgeonInput}
                    onChange={(e) => setSurgeonInput(e.target.value)}
                    placeholder="Surgeon"
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <input
                    value={procedureInput}
                    onChange={(e) => setProcedureInput(e.target.value)}
                    placeholder="Procedure"
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <input
                    value={specialtyInput}
                    onChange={(e) => setSpecialtyInput(e.target.value)}
                    placeholder="Specialty (optional)"
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <textarea
                    value={prefNotesInput}
                    onChange={(e) => setPrefNotesInput(e.target.value)}
                    placeholder="General notes"
                    className="min-h-[100px] w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <button
                    onClick={createPrefCard}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black hover:bg-white/90"
                  >
                    Create Pref Card
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-extrabold">Saved Cards</div>
                  <Pill tone="neutral">{prefCards.length}</Pill>
                </div>

                <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {prefCardsLoading ? (
                    <div className="text-sm text-white/60">Loading…</div>
                  ) : prefCards.length === 0 ? (
                    <div className="text-sm text-white/60">No pref cards yet.</div>
                  ) : (
                    prefCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => startEditingCard(card)}
                        className={cn(
                          "w-full rounded-2xl p-3 text-left ring-1 transition",
                          selectedCardId === card.id
                            ? "bg-white text-black ring-white/40"
                            : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                        )}
                      >
                        <div className="text-sm font-extrabold">
                          {card.surgeon}
                        </div>
                        <div className="mt-0.5 text-sm">
                          {card.procedure_name}
                        </div>
                        <div className="mt-1 text-xs opacity-75">
                          {card.specialty || "—"} • {card.is_active ? "Active" : "Inactive"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-extrabold">Pref Card Builder</div>
                    <div className="mt-1 text-sm text-white/60">
                      Build open / hold / PRN lists from your live item catalog.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={savePrefCardHeader}
                      disabled={!selectedPrefCard}
                      className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 disabled:opacity-50"
                    >
                      Save Header
                    </button>
                    <button
                      onClick={togglePrefCardActive}
                      disabled={!selectedPrefCard}
                      className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-extrabold ring-1 ring-white/10 disabled:opacity-50"
                    >
                      {selectedPrefCard?.is_active ? "Move Inactive" : "Restore Active"}
                    </button>
                    <button
                      onClick={deletePrefCard}
                      disabled={!selectedPrefCard}
                      className="rounded-2xl bg-rose-500/20 px-4 py-2.5 text-sm font-extrabold text-rose-100 ring-1 ring-rose-300/25 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={printPrefCard}
                      disabled={!selectedPrefCard}
                      className="rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-black disabled:opacity-50"
                    >
                      Print / Save PDF
                    </button>
                  </div>
                </div>

                {!selectedPrefCard ? (
                  <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/60 ring-1 ring-white/10">
                    Select a pref card from the left or create a new one.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <input
                        value={surgeonInput}
                        onChange={(e) => setSurgeonInput(e.target.value)}
                        placeholder="Surgeon"
                        className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                      />
                      <input
                        value={procedureInput}
                        onChange={(e) => setProcedureInput(e.target.value)}
                        placeholder="Procedure"
                        className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                      />
                      <input
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        placeholder="Specialty"
                        className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                      />
                      <div className="flex items-center">
                        <Pill tone={selectedPrefCard.is_active ? "good" : "warn"}>
                          {selectedPrefCard.is_active ? "ACTIVE CARD" : "INACTIVE CARD"}
                        </Pill>
                      </div>
                    </div>

                    <textarea
                      value={prefNotesInput}
                      onChange={(e) => setPrefNotesInput(e.target.value)}
                      placeholder="General notes"
                      className="mt-3 min-h-[90px] w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                    />

                    <div className="mt-4 rounded-3xl bg-black/30 p-4 ring-1 ring-white/10">
                      <div className="text-base font-extrabold">Add Items</div>
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder="Search items by name, barcode, ref, vendor…"
                          className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                        />
                        <div className="text-xs text-white/50">
                          Type 2+ characters to search your existing items.
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {itemSearchLoading ? (
                          <div className="text-sm text-white/60">Searching…</div>
                        ) : itemResults.length === 0 ? (
                          <div className="text-sm text-white/50">No search results yet.</div>
                        ) : (
                          itemResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => addItemToPrefCard(r)}
                              className="w-full rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/10 hover:bg-white/10"
                            >
                              <div className="text-sm font-extrabold">{r.name || "—"}</div>
                              <div className="mt-1 text-xs text-white/55 break-words">
                                {r.vendor || "—"} • {r.category || "—"}
                                {r.reference_number ? ` • ${r.reference_number}` : ""}
                                {r.barcode ? ` • ${r.barcode}` : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl bg-black/30 p-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-extrabold">Pref Card Items</div>
                        <div className="flex gap-2">
                          <Pill tone="good">OPEN {openItems.length}</Pill>
                          <Pill tone="warn">HOLD {holdItems.length}</Pill>
                          <Pill tone="neutral">PRN {prnItems.length}</Pill>
                        </div>
                      </div>

                      {prefItemsLoading ? (
                        <div className="mt-4 text-sm text-white/60">Loading items…</div>
                      ) : prefItems.length === 0 ? (
                        <div className="mt-4 text-sm text-white/60">No items on this pref card yet.</div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {prefItems.map((row) => (
                            <div
                              key={row.id}
                              className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold">
                                    {oneItem(row.items)?.name || "Unknown item"}
                                  </div>
                                  <div className="mt-1 text-xs text-white/55 break-words">
                                    {oneItem(row.items)?.vendor || "—"} • {oneItem(row.items)?.category || "—"}
                                    {oneItem(row.items)?.reference_number
                                      ? ` • ${oneItem(row.items)?.reference_number}`
                                      : ""}
                                    {oneItem(row.items)?.barcode ? ` • ${oneItem(row.items)?.barcode}` : ""}
                                  </div>
                                </div>

                                <button
                                  onClick={() => removePrefItem(row)}
                                  className="rounded-2xl bg-rose-500/15 px-3 py-2 text-xs font-extrabold text-rose-100 ring-1 ring-rose-300/20"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="mt-3 grid gap-2 md:grid-cols-4">
                                <div>
                                  <div className="mb-1 text-xs text-white/55">Qty</div>
                                  <input
                                    defaultValue={String(row.qty ?? 1)}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={(e) => savePrefItem(row, "qty", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  />
                                </div>

                                <div>
                                  <div className="mb-1 text-xs text-white/55">Status</div>
                                  <select
                                    value={row.status}
                                    onChange={(e) => savePrefItem(row, "status", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  >
                                    <option value="OPEN">OPEN</option>
                                    <option value="HOLD">HOLD</option>
                                    <option value="PRN">PRN</option>
                                  </select>
                                </div>

                                <div>
                                  <div className="mb-1 text-xs text-white/55">Sort</div>
                                  <input
                                    defaultValue={String(row.sort_order ?? 0)}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={(e) => savePrefItem(row, "sort_order", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  />
                                </div>

                                <div className="flex items-end">
                                  {savingPrefKey?.startsWith(row.id) ? (
                                    <Pill tone="neutral">Saving…</Pill>
                                  ) : (
                                    <Pill
                                      tone={
                                        row.status === "OPEN"
                                          ? "good"
                                          : row.status === "HOLD"
                                          ? "warn"
                                          : "neutral"
                                      }
                                    >
                                      {row.status}
                                    </Pill>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2">
                                <div className="mb-1 text-xs text-white/55">Notes</div>
                                <input
                                  defaultValue={row.notes || ""}
                                  onBlur={(e) => savePrefItem(row, "notes", e.target.value)}
                                  className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  placeholder="Optional line note"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10 print:bg-white print:text-black print:ring-0">
                      <div className="text-lg font-extrabold">Generated Pref Card</div>
                      <div className="mt-2 text-sm">
                        <div>
                          <span className="font-extrabold">Surgeon:</span> {surgeonInput || "—"}
                        </div>
                        <div>
                          <span className="font-extrabold">Procedure:</span> {procedureInput || "—"}
                        </div>
                        <div>
                          <span className="font-extrabold">Specialty:</span> {specialtyInput || "—"}
                        </div>
                      </div>

                      {prefNotesInput && (
                        <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10 print:bg-black/5 print:ring-black/10">
                          <div className="font-extrabold">General Notes</div>
                          <div className="mt-1 whitespace-pre-wrap">{prefNotesInput}</div>
                        </div>
                      )}

                      <div className="mt-4 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl bg-emerald-500/8 p-3 ring-1 ring-emerald-400/20 print:bg-black/5 print:ring-black/10">
                          <div className="text-sm font-extrabold">OPEN</div>
                          <div className="mt-2 space-y-2">
                            {openItems.length === 0 ? (
                              <div className="text-sm opacity-70">None</div>
                            ) : (
                              openItems.map((x) => (
                                <div key={x.id} className="text-sm">
                                  <div className="font-semibold">
                                    {oneItem(x.items)?.name || "Unknown"} × {x.qty}
                                  </div>
                                  {x.notes && <div className="text-xs opacity-75">{x.notes}</div>}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-amber-500/8 p-3 ring-1 ring-amber-400/20 print:bg-black/5 print:ring-black/10">
                          <div className="text-sm font-extrabold">HOLD</div>
                          <div className="mt-2 space-y-2">
                            {holdItems.length === 0 ? (
                              <div className="text-sm opacity-70">None</div>
                            ) : (
                              holdItems.map((x) => (
                                <div key={x.id} className="text-sm">
                                  <div className="font-semibold">
                                    {oneItem(x.items)?.name || "Unknown"} × {x.qty}
                                  </div>
                                  {x.notes && <div className="text-xs opacity-75">{x.notes}</div>}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 print:bg-black/5 print:ring-black/10">
                          <div className="text-sm font-extrabold">PRN</div>
                          <div className="mt-2 space-y-2">
                            {prnItems.length === 0 ? (
                              <div className="text-sm opacity-70">None</div>
                            ) : (
                              prnItems.map((x) => (
                                <div key={x.id} className="text-sm">
                                  <div className="font-semibold">
                                    {oneItem(x.items)?.name || "Unknown"} × {x.qty}
                                  </div>
                                  {x.notes && <div className="text-xs opacity-75">{x.notes}</div>}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-black/80 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-xl">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
