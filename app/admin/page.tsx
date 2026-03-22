"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type AdminTab = "inventory" | "prefcards" | "orders";

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
    reference_number?: string | null;
    unit?: string | null;
    order_status?: string | null;
    backordered?: boolean | null;
  } | null;
};

type Area = {
  id: string;
  name: string;
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

type PullSession = {
  id: string;
  pref_card_id: string;
  session_name: string;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
  is_posted: boolean;
  posted_at: string | null;
  posted_by: string | null;
};

type PullSessionItem = {
  id: string;
  session_id: string;
  pref_card_item_id: string | null;
  item_id: string;
  storage_area_id: string | null;
  line_type: "OPEN" | "HOLD" | "PRN";
  planned_qty: number;
  pulled_qty: number;
  used_qty: number;
  notes: string | null;
  sort_order: number;
  items?: ItemSearchRow | ItemSearchRow[] | null;
  storage_areas?: { id?: string | null; name?: string | null } | null;
};

type ApiResp = {
  ok: boolean;
  rows?: Row[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

type OrderItemLookupRow = {
  id: string;
  name: string | null;
  barcode: string | null;
  vendor: string | null;
  category: string | null;
  reference_number: string | null;
  unit: string | null;
};

type OrderLineRow = {
  id: string;
  item_id: string;
  qty_ordered: number;
  qty_received: number;
  status: "ORDERED" | "BACKORDER" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  notes: string | null;
  purchase_order_id?: string | null;
  purchase_orders?: {
    id?: string | null;
    po_number?: string | null;
    vendor?: string | null;
    status?: string | null;
    expected_date?: string | null;
    order_date?: string | null;
    notes?: string | null;
  } | null;
};

const ITEM_STATUS_OPTIONS = [
  "IN STOCK",
  "ORDERED",
  "BACKORDER",
  "PARTIAL",
  "OUT OF STOCK",
  "RECEIVED",
  "CANCELLED",
] as const;

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
        active && "bg-white text-black ring-white/40 hover:bg-white"
      )}
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
    <div className={cn("rounded-2xl px-3 py-2 ring-1", toneCls)}>
      <div className="text-[10px] tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-white/90 tabular-nums">
        {value}
      </div>
    </div>
  );
}

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

  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Inventory
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

  // Areas
  const [areas, setAreas] = useState<Area[]>([]);

  // Pref cards
  const [prefCards, setPrefCards] = useState<PrefCard[]>([]);
  const [prefCardsLoading, setPrefCardsLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("");
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

  // Pull sessions
  const [sessions, setSessions] = useState<PullSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionItems, setSessionItems] = useState<PullSessionItem[]>([]);
  const [sessionItemsLoading, setSessionItemsLoading] = useState(false);
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);

  const [sessionNameInput, setSessionNameInput] = useState("");
  const [sessionDateInput, setSessionDateInput] = useState("");
  const [sessionNotesInput, setSessionNotesInput] = useState("");
  const [staffNameInput, setStaffNameInput] = useState("");

  // Order item lookup
  const [orderLookupQuery, setOrderLookupQuery] = useState("");
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [orderLookupResults, setOrderLookupResults] = useState<OrderItemLookupRow[]>([]);
  const dOrderLookupQuery = useDebounced(orderLookupQuery, 250);

  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItemLookupRow | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLineRow[]>([]);
  const [orderLinesLoading, setOrderLinesLoading] = useState(false);
  const [savingOrderKey, setSavingOrderKey] = useState<string | null>(null);

  useEffect(() => {
    setLocked(false);
    try {
      localStorage.setItem("ASC_ADMIN_UNLOCKED", "true");
      const savedStaff = localStorage.getItem("ASC_CASE_POSTED_BY") || "";
      setStaffNameInput(savedStaff);
    } catch {}
    loadAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadAreas() {
    const { data, error } = await supabase
      .from("storage_areas")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      setToast(`Areas load failed: ${error.message}`);
      return;
    }

    setAreas((data || []) as Area[]);
  }

  // ---------------- Inventory ----------------

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
        if (entries[0].isIntersecting) loadMore();
      },
      { root: null, rootMargin: "900px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, hasMore, loadingMore, dq, onlyLow, tab]);

  async function saveCell(r: Row, field: "on_hand" | "par_level", value: string) {
    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      setToast("Enter a valid number");
      return;
    }

    const rowKey = `${r.storage_area_id}:${r.item_id}:${field}`;
    setSavingKey(rowKey);

    const { error } = await supabase
      .from("storage_inventory")
      .update({ [field]: num })
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
          ? { ...x, [field]: num }
          : x
      )
    );

    setSavingKey(null);
    setToast("Saved ✅");
  }

  async function saveItemStatus(
    r: Row,
    field: "order_status" | "backordered",
    value: string | boolean
  ) {
    const rowKey = `${r.storage_area_id}:${r.item_id}:${field}`;
    setSavingKey(rowKey);

    const patch =
      field === "order_status"
        ? { order_status: String(value || "IN STOCK").trim().toUpperCase() }
        : { backordered: !!value };

    const { error } = await supabase
      .from("items")
      .update(patch)
      .eq("id", r.item_id);

    if (error) {
      setToast(`Save failed: ${error.message}`);
      setSavingKey(null);
      return;
    }

    setRows((prev) =>
      prev.map((x) =>
        x.item_id === r.item_id
          ? {
              ...x,
              items: {
                ...(x.items || {}),
                ...(patch as any),
              },
            }
          : x
      )
    );

    setSavingKey(null);
    setToast("Item status saved ✅");
  }

  // ---------------- Pref Cards ----------------

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

  async function createPrefCard() {
    if (!surgeonInput.trim()) return setToast("Enter surgeon");
    if (!procedureInput.trim()) return setToast("Enter procedure");

    const { data, error } = await supabase
      .from("pref_cards")
      .insert({
        surgeon: surgeonInput.trim(),
        procedure_name: procedureInput.trim(),
        specialty: specialtyInput.trim() || null,
        notes: prefNotesInput.trim() || null,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) return setToast(`Create failed: ${error.message}`);

    setToast("Pref card created ✅");
    await loadPrefCards();
    if (data?.id) setSelectedCardId(data.id);

    setSurgeonInput("");
    setProcedureInput("");
    setSpecialtyInput("");
    setPrefNotesInput("");
  }

  async function savePrefCardHeader() {
    if (!selectedCardId) return;

    const { error } = await supabase
      .from("pref_cards")
      .update({
        surgeon: surgeonInput.trim(),
        procedure_name: procedureInput.trim(),
        specialty: specialtyInput.trim() || null,
        notes: prefNotesInput.trim() || null,
      })
      .eq("id", selectedCardId);

    if (error) return setToast(`Save failed: ${error.message}`);

    setToast("Pref card saved ✅");
    await loadPrefCards();
  }

  async function togglePrefCardActive() {
    const selected = prefCards.find((c) => c.id === selectedCardId);
    if (!selected) return;

    const { error } = await supabase
      .from("pref_cards")
      .update({ is_active: !selected.is_active })
      .eq("id", selected.id);

    if (error) return setToast(`Update failed: ${error.message}`);

    setToast(selected.is_active ? "Moved inactive" : "Restored active");
    await loadPrefCards();
  }

  async function deletePrefCard() {
    const selected = prefCards.find((c) => c.id === selectedCardId);
    if (!selected) return;

    const ok = confirm(
      `Delete pref card?\n\n${selected.surgeon} — ${selected.procedure_name}\n\nThis deletes all pref card items and case pull sessions.`
    );
    if (!ok) return;

    const { error } = await supabase.from("pref_cards").delete().eq("id", selected.id);
    if (error) return setToast(`Delete failed: ${error.message}`);

    setSelectedCardId("");
    setSelectedSessionId("");
    setPrefItems([]);
    setSessionItems([]);
    setToast("Pref card deleted");
    await loadPrefCards();
  }

  function startEditingCard(card: PrefCard) {
    setSelectedCardId(card.id);
    setSurgeonInput(card.surgeon || "");
    setProcedureInput(card.procedure_name || "");
    setSpecialtyInput(card.specialty || "");
    setPrefNotesInput(card.notes || "");
  }

  async function addItemToPrefCard(itemRow: ItemSearchRow) {
    if (!selectedCardId) return setToast("Select a pref card first");

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

    if (error) return setToast(`Add item failed: ${error.message}`);

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
    let patch: any = {};

    if (field === "qty" || field === "sort_order") {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) return setToast("Enter a valid number");
      patch = { [field]: num };
    } else if (field === "status") {
      if (!["OPEN", "HOLD", "PRN"].includes(value)) return setToast("Invalid status");
      patch = { status: value };
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
      setSavingPrefKey(null);
      return setToast(`Save failed: ${error.message}`);
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
    const ok = confirm(`Remove "${oneItem(row.items)?.name || "item"}" from this pref card?`);
    if (!ok) return;

    const { error } = await supabase.from("pref_card_items").delete().eq("id", row.id);
    if (error) return setToast(`Remove failed: ${error.message}`);

    setPrefItems((prev) => prev.filter((x) => x.id !== row.id));
    setToast("Item removed");
  }

  // ---------------- Pull Sessions ----------------

  async function loadSessions(cardId: string) {
    if (!cardId) {
      setSessions([]);
      return;
    }

    setSessionsLoading(true);

    const { data, error } = await supabase
      .from("case_pull_sessions")
      .select("*")
      .eq("pref_card_id", cardId)
      .order("created_at", { ascending: false });

    if (error) {
      setSessionsLoading(false);
      return setToast(`Sessions load failed: ${error.message}`);
    }

    const rows = ((data || []) as PullSession[]).map((x: any) => ({
      ...x,
      is_posted: !!x.is_posted,
      posted_at: x.posted_at ?? null,
      posted_by: x.posted_by ?? null,
    }));

    setSessions(rows);

    if (!selectedSessionId && rows.length > 0) {
      setSelectedSessionId(rows[0].id);
    } else if (selectedSessionId && !rows.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(rows[0]?.id || "");
    }

    setSessionsLoading(false);
  }

  async function loadSessionItems(sessionId: string) {
    if (!sessionId) {
      setSessionItems([]);
      return;
    }

    setSessionItemsLoading(true);

    const { data, error } = await supabase
      .from("case_pull_session_items")
      .select(
        "id,session_id,pref_card_item_id,item_id,storage_area_id,line_type,planned_qty,pulled_qty,used_qty,notes,sort_order,items(id,name,barcode,vendor,category,reference_number,unit),storage_areas(id,name)"
      )
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setSessionItemsLoading(false);
      return setToast(`Session items load failed: ${error.message}`);
    }

    const normalized: PullSessionItem[] = (data || []).map((row: any) => ({
      id: row.id,
      session_id: row.session_id,
      pref_card_item_id: row.pref_card_item_id,
      item_id: row.item_id,
      storage_area_id: row.storage_area_id ?? null,
      line_type: row.line_type,
      planned_qty: row.planned_qty,
      pulled_qty: row.pulled_qty,
      used_qty: row.used_qty,
      notes: row.notes,
      sort_order: row.sort_order,
      items: oneItem(row.items),
      storage_areas: row.storage_areas ?? null,
    }));

    setSessionItems(normalized);
    setSessionItemsLoading(false);
  }

  async function createPullSessionFromPrefCard() {
    if (!selectedCardId) return setToast("Select a pref card first");
    if (prefItems.length === 0) return setToast("This pref card has no items");

    const sessionName =
      sessionNameInput.trim() ||
      `${surgeonInput || "Case"} - ${procedureInput || "Pull"} - ${new Date().toLocaleDateString()}`;

    const { data: sessionData, error: sessionError } = await supabase
      .from("case_pull_sessions")
      .insert({
        pref_card_id: selectedCardId,
        session_name: sessionName,
        scheduled_for: sessionDateInput || null,
        notes: sessionNotesInput.trim() || null,
        is_posted: false,
        posted_at: null,
        posted_by: null,
      })
      .select("*")
      .single();

    if (sessionError) return setToast(`Create pull session failed: ${sessionError.message}`);

    const sessionId = sessionData.id as string;

    const insertRows = prefItems.map((x) => ({
      session_id: sessionId,
      pref_card_item_id: x.id,
      item_id: x.item_id,
      storage_area_id: null,
      line_type: x.status,
      planned_qty: x.qty,
      pulled_qty: 0,
      used_qty: 0,
      notes: x.notes,
      sort_order: x.sort_order,
    }));

    const { error: itemsError } = await supabase
      .from("case_pull_session_items")
      .insert(insertRows);

    if (itemsError) {
      return setToast(`Session lines failed: ${itemsError.message}`);
    }

    setToast("Case pull created ✅");
    setSessionNameInput("");
    setSessionDateInput("");
    setSessionNotesInput("");

    await loadSessions(selectedCardId);
    setSelectedSessionId(sessionId);
    await loadSessionItems(sessionId);
  }

  async function saveSessionItem(
    row: PullSessionItem,
    field: "planned_qty" | "pulled_qty" | "used_qty" | "notes" | "storage_area_id",
    value: string
  ) {
    let patch: any = {};

    if (field === "notes") {
      patch = { notes: value || null };
    } else if (field === "storage_area_id") {
      patch = { storage_area_id: value || null };
    } else {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) return setToast("Enter a valid number");
      patch = { [field]: num };
    }

    const key = `${row.id}:${field}`;
    setSavingSessionKey(key);

    const { error } = await supabase
      .from("case_pull_session_items")
      .update(patch)
      .eq("id", row.id);

    if (error) {
      setSavingSessionKey(null);
      return setToast(`Save failed: ${error.message}`);
    }

    setSessionItems((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? {
              ...x,
              ...patch,
              storage_areas:
                field === "storage_area_id"
                  ? areas.find((a) => a.id === value)
                    ? { id: value, name: areas.find((a) => a.id === value)?.name || null }
                    : null
                  : x.storage_areas,
            }
          : x
      )
    );

    setSavingSessionKey(null);
    setToast("Saved ✅");
  }

  async function deleteSession() {
    const selected = sessions.find((s) => s.id === selectedSessionId);
    if (!selected) return;

    const ok = confirm(`Delete pull session "${selected.session_name}"?`);
    if (!ok) return;

    const { error } = await supabase
      .from("case_pull_sessions")
      .delete()
      .eq("id", selected.id);

    if (error) return setToast(`Delete failed: ${error.message}`);

    setSelectedSessionId("");
    setSessionItems([]);
    setToast("Pull session deleted");
    await loadSessions(selectedCardId);
  }

  async function finalizeUsedItemsToInventory() {
    const selected = sessions.find((s) => s.id === selectedSessionId);
    if (!selected) return setToast("Select a session first");
    if (selected.is_posted) return setToast("This session is already posted");
    if (!staffNameInput.trim()) return setToast("Enter who is posting this case");

    const usedLines = sessionItems.filter((x) => (x.used_qty || 0) > 0);

    if (usedLines.length === 0) {
      return setToast("No used quantities entered");
    }

    const missingAreas = usedLines.filter((x) => !x.storage_area_id);
    if (missingAreas.length > 0) {
      return setToast("Choose a storage area for every used item before posting");
    }

    const ok = confirm(
      `Post used items to inventory?\n\nSession: ${selected.session_name}\nUsed lines: ${usedLines.length}\n\nThis will subtract ONLY used_qty and mark the session as posted.`
    );
    if (!ok) return;

    try {
      for (const line of usedLines) {
        const { error } = await supabase.rpc("use_stock", {
          p_item_id: line.item_id,
          p_area_id: line.storage_area_id,
          p_qty: line.used_qty,
        });

        if (error) {
          throw new Error(
            `${oneItem(line.items)?.name || "Item"}: ${error.message}`
          );
        }
      }

      const staff = staffNameInput.trim();
      try {
        localStorage.setItem("ASC_CASE_POSTED_BY", staff);
      } catch {}

      const { error: sessionError } = await supabase
        .from("case_pull_sessions")
        .update({
          is_posted: true,
          posted_at: new Date().toISOString(),
          posted_by: staff,
        })
        .eq("id", selected.id);

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      setToast("Used items posted to inventory ✅");
      await loadSessions(selectedCardId);
      await loadSessionItems(selected.id);
    } catch (e: any) {
      setToast(`Post failed: ${e?.message || "unknown error"}`);
    }
  }

  function printSession() {
    window.print();
  }

  // ---------------- Orders / item lookup ----------------

  useEffect(() => {
    if (tab !== "orders") return;

    const q = dOrderLookupQuery.trim();
    if (!q || q.length < 2) {
      setOrderLookupResults([]);
      setOrderLookupLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      setOrderLookupLoading(true);

      const { data, error } = await supabase
        .from("items")
        .select("id,name,barcode,vendor,category,reference_number,unit")
        .or(
          `name.ilike.%${q}%,barcode.ilike.%${q}%,reference_number.ilike.%${q}%,vendor.ilike.%${q}%`
        )
        .order("name", { ascending: true })
        .limit(20);

      if (!alive) return;

      if (error) {
        setOrderLookupResults([]);
        setOrderLookupLoading(false);
        return setToast(`Item lookup failed: ${error.message}`);
      }

      setOrderLookupResults((data || []) as OrderItemLookupRow[]);
      setOrderLookupLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [dOrderLookupQuery, tab]);

  async function loadOrderLinesForItem(itemId: string) {
    if (!itemId) {
      setOrderLines([]);
      return;
    }

    setOrderLinesLoading(true);

    const { data, error } = await supabase
      .from("purchase_order_items")
      .select(
        "id,item_id,qty_ordered,qty_received,status,notes,purchase_order_id,purchase_orders(id,po_number,vendor,status,expected_date,order_date,notes)"
      )
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) {
      setOrderLines([]);
      setOrderLinesLoading(false);
      return setToast(`Order lines load failed: ${error.message}`);
    }

    setOrderLines((data || []) as OrderLineRow[]);
    setOrderLinesLoading(false);
  }

  async function openOrderItem(itemRow: OrderItemLookupRow) {
    setSelectedOrderItem(itemRow);
    await loadOrderLinesForItem(itemRow.id);
  }

  async function saveOrderLine(
    row: OrderLineRow,
    field: "status" | "qty_ordered" | "qty_received" | "notes",
    value: string
  ) {
    let patch: any = {};

    if (field === "status") {
      if (!["ORDERED", "BACKORDER", "PARTIAL", "RECEIVED", "CANCELLED"].includes(value)) {
        return setToast("Invalid status");
      }
      patch = { status: value };
    } else if (field === "notes") {
      patch = { notes: value || null };
    } else {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) return setToast("Enter a valid number");
      patch = { [field]: num };
    }

    const key = `${row.id}:${field}`;
    setSavingOrderKey(key);

    const { error } = await supabase
      .from("purchase_order_items")
      .update(patch)
      .eq("id", row.id);

    if (error) {
      setSavingOrderKey(null);
      return setToast(`Save failed: ${error.message}`);
    }

    setOrderLines((prev) =>
      prev.map((x) => (x.id === row.id ? { ...x, ...patch } : x))
    );

    setSavingOrderKey(null);
    setToast("Order line saved ✅");
  }

  function clearOrderLookup() {
    setOrderLookupQuery("");
    setOrderLookupResults([]);
    setSelectedOrderItem(null);
    setOrderLines([]);
  }

  useEffect(() => {
    if (tab !== "prefcards") return;
    loadPrefCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "prefcards") return;
    if (!selectedCardId) {
      setPrefItems([]);
      setSessions([]);
      setSessionItems([]);
      return;
    }
    loadPrefItems(selectedCardId);
    loadSessions(selectedCardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, tab]);

  useEffect(() => {
    if (tab !== "prefcards") return;
    loadSessionItems(selectedSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, tab]);

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
        setItemResults([]);
        setItemSearchLoading(false);
        return setToast(`Item search failed: ${error.message}`);
      }

      setItemResults((data || []) as ItemSearchRow[]);
      setItemSearchLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [dItemSearch, tab]);

  const selectedPrefCard = useMemo(
    () => prefCards.find((c) => c.id === selectedCardId) || null,
    [prefCards, selectedCardId]
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    if (!selectedPrefCard) return;
    setSurgeonInput(selectedPrefCard.surgeon || "");
    setProcedureInput(selectedPrefCard.procedure_name || "");
    setSpecialtyInput(selectedPrefCard.specialty || "");
    setPrefNotesInput(selectedPrefCard.notes || "");
  }, [selectedPrefCard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inventoryStats = useMemo(() => {
    const total = rows.length;
    const low = rows.filter((r) => r.low).length;
    const notified = rows.filter((r) => r.low_notified).length;
    const backordered = rows.filter((r) => !!r.items?.backordered).length;
    return { total, low, notified, backordered };
  }, [rows]);

  const prefStats = useMemo(() => {
    const totalCards = prefCards.length;
    const activeCards = prefCards.filter((c) => c.is_active).length;
    const itemCount = prefItems.length;
    return { totalCards, activeCards, itemCount };
  }, [prefCards, prefItems]);

  const orderStats = useMemo(() => {
    const results = orderLookupResults.length;
    const lines = orderLines.length;
    const pending = orderLines.reduce((sum, row) => {
      const left = Math.max((row.qty_ordered ?? 0) - (row.qty_received ?? 0), 0);
      return sum + left;
    }, 0);
    return { results, lines, pending };
  }, [orderLookupResults, orderLines]);

  const openPrefItems = useMemo(
    () => prefItems.filter((x) => x.status === "OPEN"),
    [prefItems]
  );
  const holdPrefItems = useMemo(
    () => prefItems.filter((x) => x.status === "HOLD"),
    [prefItems]
  );
  const prnPrefItems = useMemo(
    () => prefItems.filter((x) => x.status === "PRN"),
    [prefItems]
  );

  const sessionOpenItems = useMemo(
    () => sessionItems.filter((x) => x.line_type === "OPEN"),
    [sessionItems]
  );
  const sessionHoldItems = useMemo(
    () => sessionItems.filter((x) => x.line_type === "HOLD"),
    [sessionItems]
  );
  const sessionPrnItems = useMemo(
    () => sessionItems.filter((x) => x.line_type === "PRN"),
    [sessionItems]
  );

  const sessionSummary = useMemo(() => {
    const planned = sessionItems.reduce((n, x) => n + (x.planned_qty || 0), 0);
    const pulled = sessionItems.reduce((n, x) => n + (x.pulled_qty || 0), 0);
    const used = sessionItems.reduce((n, x) => n + (x.used_qty || 0), 0);
    return { planned, pulled, used };
  }, [sessionItems]);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-80 w-[980px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70">
        <div className="mx-auto w-full max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.25em] text-white/45">
                BAXTER ASC • ADMIN CONSOLE
              </div>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight">
                Admin Center <span className="text-white/55">(Unlocked)</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Inventory editing, pref card building, item order lookup, and automatic case pull sessions.
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
                <div className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-extrabold text-white/70 ring-1 ring-white/10">
                  Admin unlocked
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 w-full md:w-auto">
                <StatChip label="STATE" value="OPEN" tone="good" />
                {tab === "inventory" ? (
                  <>
                    <StatChip label="ROWS" value={inventoryStats.total} />
                    <StatChip label="LOW" value={inventoryStats.low} tone={inventoryStats.low ? "warn" : "neutral"} />
                    <StatChip label="BACKORD" value={inventoryStats.backordered} tone={inventoryStats.backordered ? "warn" : "neutral"} />
                  </>
                ) : tab === "prefcards" ? (
                  <>
                    <StatChip label="CARDS" value={prefStats.totalCards} />
                    <StatChip label="ACTIVE" value={prefStats.activeCards} tone={prefStats.activeCards ? "good" : "neutral"} />
                    <StatChip label="LINES" value={prefStats.itemCount} />
                  </>
                ) : (
                  <>
                    <StatChip label="RESULTS" value={orderStats.results} />
                    <StatChip label="LINES" value={orderStats.lines} />
                    <StatChip label="PENDING" value={orderStats.pending} tone={orderStats.pending ? "warn" : "neutral"} />
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
                Pref Cards + Pulls
              </IconButton>
              <IconButton onClick={() => setTab("orders")} active={tab === "orders"}>
                Item Order Lookup
              </IconButton>
            </div>

            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-extrabold text-white/70 ring-1 ring-white/10">
                Admin editing unlocked
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-6">
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
                <div className="min-w-[1450px]">
                  <div className="sticky top-0 z-20 grid grid-cols-16 gap-0 border-b border-white/10 bg-black/70 px-4 py-3 text-xs font-semibold tracking-wider text-white/55">
                    <div className="col-span-3 sticky left-0 z-30 bg-black/70 pr-2">AREA</div>
                    <div className="col-span-4 sticky left-[240px] z-30 bg-black/70 pr-2">ITEM</div>
                    <div className="col-span-2">BARCODE</div>
                    <div className="col-span-1 text-center">ON HAND</div>
                    <div className="col-span-1 text-center">PAR</div>
                    <div className="col-span-2 text-center">ORDER STATUS</div>
                    <div className="col-span-1 text-center">BACKORDER</div>
                    <div className="col-span-2 sticky right-0 z-30 bg-black/70 text-right pl-2">ROW STATUS</div>
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
                        const itemStatus = r.items?.order_status || "IN STOCK";
                        const isBackordered = !!r.items?.backordered;
                        const statusTone =
                          r.low || isBackordered
                            ? "warn"
                            : itemStatus === "OUT OF STOCK" || itemStatus === "CANCELLED"
                            ? "bad"
                            : "good";
                        const rowKey = `${r.storage_area_id}:${r.item_id}`;

                        return (
                          <div
                            key={rowKey}
                            className={cn(
                              "grid grid-cols-16 items-center gap-0 px-4 py-3 transition",
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
                                {r.items?.reference_number ? ` • Ref: ${r.items.reference_number}` : ""}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <div className="text-sm text-white/80 break-all">{barcode || "—"}</div>
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <input
                                defaultValue={String(r.on_hand ?? 0)}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) => saveCell(r, "on_hand", e.target.value)}
                                className="w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums ring-1 ring-white/10 outline-none focus:ring-white/30"
                              />
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <input
                                defaultValue={String(r.par_level ?? 0)}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) => saveCell(r, "par_level", e.target.value)}
                                className="w-20 rounded-2xl bg-white/5 px-3 py-2 text-center text-sm font-extrabold tabular-nums ring-1 ring-white/10 outline-none focus:ring-white/30"
                              />
                            </div>

                            <div className="col-span-2 flex justify-center px-2">
                              <select
                                value={itemStatus}
                                onChange={(e) => saveItemStatus(r, "order_status", e.target.value)}
                                className="w-full rounded-2xl bg-white/5 px-3 py-2 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                              >
                                {ITEM_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <label className="inline-flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isBackordered}
                                  onChange={(e) =>
                                    saveItemStatus(r, "backordered", e.target.checked)
                                  }
                                  className="h-5 w-5 rounded"
                                />
                              </label>
                            </div>

                            <div className="col-span-2 sticky right-0 z-10 bg-black/60 pl-2 flex justify-end">
                              <div className="flex items-center gap-2">
                                {(savingKey === `${rowKey}:on_hand` ||
                                  savingKey === `${rowKey}:par_level` ||
                                  savingKey === `${rowKey}:order_status` ||
                                  savingKey === `${rowKey}:backordered`) && (
                                  <Pill tone="neutral">Saving…</Pill>
                                )}

                                {isBackordered ? (
                                  <Pill tone="warn">BACKORDERED</Pill>
                                ) : (
                                  <Pill tone={statusTone as any}>
                                    {r.low ? "LOW" : itemStatus || "OK"}
                                  </Pill>
                                )}
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
        ) : tab === "prefcards" ? (
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
                        <div className="text-sm font-extrabold">{card.surgeon}</div>
                        <div className="mt-0.5 text-sm">{card.procedure_name}</div>
                        <div className="mt-1 text-xs opacity-75">
                          {card.specialty || "—"} • {card.is_active ? "Active" : "Inactive"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-extrabold">Pull Sessions</div>
                  <Pill tone="neutral">{sessions.length}</Pill>
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    value={sessionNameInput}
                    onChange={(e) => setSessionNameInput(e.target.value)}
                    placeholder="Case / session name"
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <input
                    type="date"
                    value={sessionDateInput}
                    onChange={(e) => setSessionDateInput(e.target.value)}
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <textarea
                    value={sessionNotesInput}
                    onChange={(e) => setSessionNotesInput(e.target.value)}
                    placeholder="Session notes"
                    className="min-h-[80px] w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <button
                    onClick={createPullSessionFromPrefCard}
                    disabled={!selectedCardId || prefItems.length === 0}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black disabled:opacity-50"
                  >
                    Auto Build Case Pull From Pref Card
                  </button>
                </div>

                <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {sessionsLoading ? (
                    <div className="text-sm text-white/60">Loading…</div>
                  ) : sessions.length === 0 ? (
                    <div className="text-sm text-white/60">No pull sessions yet.</div>
                  ) : (
                    sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSessionId(s.id)}
                        className={cn(
                          "w-full rounded-2xl p-3 text-left ring-1 transition",
                          selectedSessionId === s.id
                            ? "bg-white text-black ring-white/40"
                            : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                        )}
                      >
                        <div className="text-sm font-extrabold">{s.session_name}</div>
                        <div className="mt-1 text-xs opacity-75">
                          {s.scheduled_for || "No date"} • {new Date(s.created_at).toLocaleString()}
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
                      Build the standard supply card, then auto-create pull sessions from it.
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
                      Delete Card
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
                      <div className="text-base font-extrabold">Add Standard Items</div>
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder="Search items by name, barcode, ref, vendor…"
                          className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                        />
                        <div className="text-xs text-white/50">
                          Type 2+ characters to search your current items.
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
                          <Pill tone="good">OPEN {openPrefItems.length}</Pill>
                          <Pill tone="warn">HOLD {holdPrefItems.length}</Pill>
                          <Pill tone="neutral">PRN {prnPrefItems.length}</Pill>
                        </div>
                      </div>

                      {prefItemsLoading ? (
                        <div className="mt-4 text-sm text-white/60">Loading items…</div>
                      ) : prefItems.length === 0 ? (
                        <div className="mt-4 text-sm text-white/60">No items on this pref card yet.</div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {prefItems.map((row) => (
                            <div key={row.id} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
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

                    <div className="mt-4 rounded-3xl bg-black/30 p-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-extrabold">Active Case Pull Session</div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone="neutral">Planned {sessionSummary.planned}</Pill>
                          <Pill tone="warn">Pulled {sessionSummary.pulled}</Pill>
                          <Pill tone="good">Used {sessionSummary.used}</Pill>
                        </div>
                      </div>

                      {!selectedSession ? (
                        <div className="mt-4 text-sm text-white/60">
                          Build a case pull session from this pref card to automatically pull all needed lines.
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Pill tone="good">{selectedSession.session_name}</Pill>
                            <Pill tone="neutral">{selectedSession.scheduled_for || "No date"}</Pill>
                            <Pill tone={selectedSession.is_posted ? "good" : "warn"}>
                              {selectedSession.is_posted ? "POSTED" : "NOT POSTED"}
                            </Pill>
                            {selectedSession.posted_by && (
                              <Pill tone="neutral">By {selectedSession.posted_by}</Pill>
                            )}
                            <button
                              onClick={deleteSession}
                              className="rounded-2xl bg-rose-500/15 px-3 py-2 text-xs font-extrabold text-rose-100 ring-1 ring-rose-300/20"
                            >
                              Delete Session
                            </button>
                            <button
                              onClick={printSession}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-black"
                            >
                              Print / Save PDF
                            </button>
                          </div>

                          <div className="mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                            <div className="mb-2 text-xs text-white/55">Post used items as</div>
                            <div className="flex flex-col gap-2 md:flex-row">
                              <input
                                value={staffNameInput}
                                onChange={(e) => setStaffNameInput(e.target.value)}
                                placeholder="Your name"
                                className="flex-1 rounded-2xl bg-black/30 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                              />
                              <button
                                onClick={finalizeUsedItemsToInventory}
                                disabled={selectedSession.is_posted}
                                className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black disabled:opacity-50"
                              >
                                {selectedSession.is_posted ? "Already Posted" : "Finalize Used Items"}
                              </button>
                            </div>

                            <div className="mt-2 text-xs text-white/50">
                              This subtracts only <span className="font-semibold">used_qty</span> from inventory and prevents double-posting.
                            </div>
                          </div>

                          {sessionItemsLoading ? (
                            <div className="mt-4 text-sm text-white/60">Loading session lines…</div>
                          ) : sessionItems.length === 0 ? (
                            <div className="mt-4 text-sm text-white/60">No lines in this session.</div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              {[
                                { title: "OPEN", rows: sessionOpenItems },
                                { title: "HOLD", rows: sessionHoldItems },
                                { title: "PRN", rows: sessionPrnItems },
                              ].map((group) => (
                                <div key={group.title} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                                  <div className="text-sm font-extrabold">{group.title}</div>

                                  <div className="mt-3 space-y-3">
                                    {group.rows.length === 0 ? (
                                      <div className="text-sm text-white/50">None</div>
                                    ) : (
                                      group.rows.map((row) => (
                                        <div key={row.id} className="rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                                          <div className="text-sm font-extrabold">
                                            {oneItem(row.items)?.name || "Unknown item"}
                                          </div>
                                          <div className="mt-1 text-xs text-white/55 break-words">
                                            {oneItem(row.items)?.vendor || "—"} • {oneItem(row.items)?.category || "—"}
                                            {oneItem(row.items)?.reference_number
                                              ? ` • ${oneItem(row.items)?.reference_number}`
                                              : ""}
                                          </div>

                                          <div className="mt-3 grid gap-2 md:grid-cols-5">
                                            <div>
                                              <div className="mb-1 text-xs text-white/55">Location</div>
                                              <select
                                                value={row.storage_area_id || ""}
                                                onChange={(e) =>
                                                  saveSessionItem(row, "storage_area_id", e.target.value)
                                                }
                                                disabled={selectedSession.is_posted}
                                                className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30 disabled:opacity-60"
                                              >
                                                <option value="">Select area</option>
                                                {areas.map((a) => (
                                                  <option key={a.id} value={a.id}>
                                                    {a.name}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>

                                            <div>
                                              <div className="mb-1 text-xs text-white/55">Planned</div>
                                              <input
                                                defaultValue={String(row.planned_qty ?? 0)}
                                                onFocus={(e) => e.currentTarget.select()}
                                                onBlur={(e) =>
                                                  saveSessionItem(row, "planned_qty", e.target.value)
                                                }
                                                disabled={selectedSession.is_posted}
                                                className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30 disabled:opacity-60"
                                              />
                                            </div>

                                            <div>
                                              <div className="mb-1 text-xs text-white/55">Pulled</div>
                                              <input
                                                defaultValue={String(row.pulled_qty ?? 0)}
                                                onFocus={(e) => e.currentTarget.select()}
                                                onBlur={(e) =>
                                                  saveSessionItem(row, "pulled_qty", e.target.value)
                                                }
                                                disabled={selectedSession.is_posted}
                                                className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30 disabled:opacity-60"
                                              />
                                            </div>

                                            <div>
                                              <div className="mb-1 text-xs text-white/55">Used</div>
                                              <input
                                                defaultValue={String(row.used_qty ?? 0)}
                                                onFocus={(e) => e.currentTarget.select()}
                                                onBlur={(e) =>
                                                  saveSessionItem(row, "used_qty", e.target.value)
                                                }
                                                disabled={selectedSession.is_posted}
                                                className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30 disabled:opacity-60"
                                              />
                                            </div>

                                            <div className="flex items-end">
                                              {savingSessionKey?.startsWith(row.id) ? (
                                                <Pill tone="neutral">Saving…</Pill>
                                              ) : (
                                                <Pill tone="neutral">{row.line_type}</Pill>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-2">
                                            <div className="mb-1 text-xs text-white/55">Notes</div>
                                            <input
                                              defaultValue={row.notes || ""}
                                              onBlur={(e) =>
                                                saveSessionItem(row, "notes", e.target.value)
                                              }
                                              disabled={selectedSession.is_posted}
                                              className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30 disabled:opacity-60"
                                              placeholder="Case line notes"
                                            />
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/5">
                <div className="text-lg font-extrabold">Find Item Orders</div>
                <div className="mt-1 text-sm text-white/60">
                  Search by name, barcode, ref number, or vendor.
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    value={orderLookupQuery}
                    onChange={(e) => setOrderLookupQuery(e.target.value)}
                    placeholder="Search item..."
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (selectedOrderItem) loadOrderLinesForItem(selectedOrderItem.id);
                      }}
                      className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={clearOrderLookup}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {orderLookupLoading ? (
                    <div className="text-sm text-white/60">Searching…</div>
                  ) : orderLookupQuery.trim().length < 2 ? (
                    <div className="text-sm text-white/50">Type at least 2 characters.</div>
                  ) : orderLookupResults.length === 0 ? (
                    <div className="text-sm text-white/60">No matching items.</div>
                  ) : (
                    orderLookupResults.map((itemRow) => (
                      <button
                        key={itemRow.id}
                        onClick={() => openOrderItem(itemRow)}
                        className={cn(
                          "w-full rounded-2xl p-3 text-left ring-1 transition",
                          selectedOrderItem?.id === itemRow.id
                            ? "bg-white text-black ring-white/40"
                            : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                        )}
                      >
                        <div className="text-sm font-extrabold">{itemRow.name || "—"}</div>
                        <div className="mt-1 text-xs opacity-75 break-words">
                          {itemRow.vendor || "—"} • {itemRow.category || "—"}
                          {itemRow.reference_number ? ` • ${itemRow.reference_number}` : ""}
                        </div>
                        <div className="mt-1 text-xs opacity-60 break-all">
                          {itemRow.barcode || "No barcode"}
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
                    <div className="text-lg font-extrabold">Item Order Editor</div>
                    <div className="mt-1 text-sm text-white/60">
                      See every purchase order line tied to the selected item and update status/quantities.
                    </div>
                  </div>
                  {selectedOrderItem && (
                    <Pill tone="good">{selectedOrderItem.name || "Selected item"}</Pill>
                  )}
                </div>

                {!selectedOrderItem ? (
                  <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/60 ring-1 ring-white/10">
                    Search for an item on the left, then tap it to load all order lines.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                      <div className="text-sm font-extrabold">
                        {selectedOrderItem.name || "Unknown item"}
                      </div>
                      <div className="mt-2 text-xs text-white/55 break-words">
                        {selectedOrderItem.vendor || "—"} • {selectedOrderItem.category || "—"}
                        {selectedOrderItem.reference_number
                          ? ` • ${selectedOrderItem.reference_number}`
                          : ""}
                      </div>
                      <div className="mt-1 text-xs text-white/45 break-all">
                        Barcode: {selectedOrderItem.barcode || "—"}
                      </div>
                    </div>

                    {orderLinesLoading ? (
                      <div className="mt-4 text-sm text-white/60">Loading order lines…</div>
                    ) : orderLines.length === 0 ? (
                      <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/60 ring-1 ring-white/10">
                        No purchase order lines found for this item.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {orderLines.map((row) => {
                          const pending = Math.max(
                            (row.qty_ordered ?? 0) - (row.qty_received ?? 0),
                            0
                          );

                          return (
                            <div
                              key={row.id}
                              className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold break-words">
                                    PO {row.purchase_orders?.po_number || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-white/55 break-words">
                                    {row.purchase_orders?.vendor || "—"} • PO status:{" "}
                                    {row.purchase_orders?.status || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-white/45">
                                    Expected: {row.purchase_orders?.expected_date || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-white/45">
                                    Pending on this line: {pending}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {savingOrderKey?.startsWith(row.id) ? (
                                    <Pill tone="neutral">Saving…</Pill>
                                  ) : (
                                    <Pill
                                      tone={
                                        row.status === "BACKORDER"
                                          ? "warn"
                                          : row.status === "CANCELLED"
                                          ? "bad"
                                          : row.status === "RECEIVED"
                                          ? "good"
                                          : "neutral"
                                      }
                                    >
                                      {row.status}
                                    </Pill>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 grid gap-2 md:grid-cols-4">
                                <div>
                                  <div className="mb-1 text-xs text-white/55">Line status</div>
                                  <select
                                    value={row.status}
                                    onChange={(e) => saveOrderLine(row, "status", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  >
                                    <option value="ORDERED">ORDERED</option>
                                    <option value="BACKORDER">BACKORDER</option>
                                    <option value="PARTIAL">PARTIAL</option>
                                    <option value="RECEIVED">RECEIVED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                  </select>
                                </div>

                                <div>
                                  <div className="mb-1 text-xs text-white/55">Qty ordered</div>
                                  <input
                                    defaultValue={String(row.qty_ordered ?? 0)}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={(e) => saveOrderLine(row, "qty_ordered", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  />
                                </div>

                                <div>
                                  <div className="mb-1 text-xs text-white/55">Qty received</div>
                                  <input
                                    defaultValue={String(row.qty_received ?? 0)}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onBlur={(e) => saveOrderLine(row, "qty_received", e.target.value)}
                                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  />
                                </div>

                                <div className="flex items-end">
                                  <div className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm font-extrabold ring-1 ring-white/10">
                                    Pending: {pending}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="mb-1 text-xs text-white/55">Line notes</div>
                                <input
                                  defaultValue={row.notes || ""}
                                  onBlur={(e) => saveOrderLine(row, "notes", e.target.value)}
                                  className="w-full rounded-2xl bg-white/5 px-3 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-white/30"
                                  placeholder="Backorder note / vendor note / etc."
                                />
                              </div>

                              {row.purchase_orders?.notes && (
                                <div className="mt-3 rounded-2xl bg-white/5 p-3 text-xs text-white/55 ring-1 ring-white/10">
                                  PO Notes: {row.purchase_orders.notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
