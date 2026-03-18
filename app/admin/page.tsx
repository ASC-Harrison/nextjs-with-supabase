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

type PullSession = {
  id: string;
  pref_card_id: string;
  session_name: string;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
};

type PullSessionItem = {
  id: string;
  session_id: string;
  pref_card_item_id: string | null;
  item_id: string;
  line_type: "OPEN" | "HOLD" | "PRN";
  planned_qty: number;
  pulled_qty: number;
  used_qty: number;
  notes: string | null;
  sort_order: number;
  items?: ItemSearchRow | ItemSearchRow[] | null;
};

type ApiResp = {
  ok: boolean;
  rows?: Row[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
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

  // Inventory tab
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

  // Pref cards
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

  // Pull sessions
  const [sessions, setSessions] = useState<PullSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionItems, setSessionItems] = useState<PullSessionItem[]>([]);
  const [sessionItemsLoading, setSessionItemsLoading] = useState(false);
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);

  const [sessionNameInput, setSessionNameInput] = useState("");
  const [sessionDateInput, setSessionDateInput] = useState("");
  const [sessionNotesInput, setSessionNotesInput] = useState("");

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

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const prefStats = useMemo(() => {
    const totalCards = prefCards.length;
    const activeCards = prefCards.filter((c) => c.is_active).length;
    const itemCount = prefItems.length;
    return { totalCards, activeCards, itemCount };
  }, [prefCards, prefItems]);

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
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function openPinAndUnlock() {
    const stored = localStorage.getItem(LS_PIN) || "";
    if (!stored) {
      setToast("No admin PIN set yet.");
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

  async function loadSessions(cardId: string) {
    if (!cardId) {
      setSessions([]);
      return;
    }

    setSessionsLoading(true);

    const { data, error } = await supabase
      .from("case_pull_sessions")
      .select("*")
