"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrowserMultiFormatReader } from "@zxing/browser";
import { createClient } from "@supabase/supabase-js";
import { useSessionTimeout } from "@/lib/use-session-timeout";

type Tab        = "Transaction" | "Totals" | "Audit" | "Settings";
type Mode       = "USE" | "RESTOCK";
type LookupMode = "BARCODE" | "REF" | "NAME";
type Area = { id: string; name: string };
type Item = { id: string; name: string; barcode: string; reference_number?: string | null; order_status?: string | null; backordered?: boolean | null; };
type AuditEvent = { id: string; ts: string; staff: string; action: "SCAN"|"LOOKUP_FOUND"|"LOOKUP_NOT_FOUND"|"ADD_ITEM"|"SUBMIT_TX"|"UNDO_TX"|"CHANGE_LOCATION"|"LOCK"|"UNLOCK"|"MAIN_OVERRIDE_ON"|"MAIN_OVERRIDE_OFF"|"SCANNER_OPEN"|"SCANNER_CLOSE"|"TOTALS_SET"|"TOTALS_ADJUST"|"AREA_LIST_LOAD"|"AREA_LIST_TOGGLE"|"AREA_ROW_EDIT_OPEN"|"AREA_ROW_EDIT_SAVE"|"ITEM_INACTIVE"|"ITEM_RESTORED"|"ITEM_STATUS_SAVE"; details?: string; };
type BuildingTotalRow = { item_id: string; name: string; reference_number: string | null; vendor: string | null; category: string | null; total_on_hand: number | null; par_level: number | null; low_level: number | null; unit: string | null; notes: string | null; is_active: boolean | null; order_status?: string | null; backordered?: boolean | null; supply_source?: string | null; price?: number | null; expiration_date?: string | null; };
type AreaInvRow = { storage_area_id: string; storage_area_name: string; item_id: string; item_name: string; on_hand: number | null; par_level: number | null; low_level: number | null; unit: string | null; vendor: string | null; category: string | null; reference_number: string | null; notes: string | null; order_status?: string | null; backordered?: boolean | null; };
type LastTx = { storage_area_id: string; mode: Mode; item_id: string; qty: number; mainOverride: boolean; item_name?: string; area_name?: string; ts: string; };
type OrderStatusRow = { id: string; qty_ordered: number; qty_received: number; status: "ORDERED"|"BACKORDER"|"PARTIAL"|"RECEIVED"|"CANCELLED"; notes: string | null; purchase_orders?: { id?: string|null; po_number?: string|null; vendor?: string|null; status?: string|null; expected_date?: string|null; order_date?: string|null; notes?: string|null; }|null; };

const ITEM_STATUS_OPTIONS = ["IN STOCK","ORDERED","BACKORDER","PARTIAL","OUT OF STOCK","RECEIVED","CANCELLED"] as const;
const SUPPLY_SOURCE_OPTIONS = [{ value:"VENDOR", label:"Outside Vendor" },{ value:"HOSPITAL", label:"Main Hospital (Baxter)" },{ value:"BOTH", label:"Both - Hospital + Vendor" }] as const;
const LS = { PIN:"asc_pin_v1", AREA:"asc_area_id_v1", STAFF:"asc_staff_name_v1", AUDIT:"asc_audit_events_v1", LAST_TX:"asc_last_tx_v1" };
const SS = { UNLOCKED:"asc_edit_unlocked_session_v1" };
const MAIN_SUPPLY_ID = "a09eb27b-e4a1-449a-8d2e-c45b24d6514f";

function nowIso(): string { return new Date().toISOString(); }
function uid(): string { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function safeJsonParse<T>(raw: string | null, fallback: T): T { if (!raw) return fallback; try { return JSON.parse(raw) as T; } catch { return fallback; } }
function getSessionUnlocked(): boolean { if (typeof window === "undefined") return false; return sessionStorage.getItem(SS.UNLOCKED) === "1"; }
function setSessionUnlocked(value: boolean): void { if (typeof window === "undefined") return; if (value) sessionStorage.setItem(SS.UNLOCKED, "1"); else sessionStorage.removeItem(SS.UNLOCKED); }
function supplySourceLabel(s: string|null|undefined): {label:string;cls:string} { if (s==="HOSPITAL") return {label:"Hospital",cls:"src-hosp"}; if (s==="BOTH") return {label:"Both",cls:"src-both"}; return {label:"Vendor",cls:"src-vend"}; }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const PREMIUM_CSS = `
  :root {
    --bg: #0a0f1e; --bg2: #111827; --card: #162032; --card2: #1a2840;
    --surface: #1e2d42; --input-bg: #111827; --border: #1e3a5f;
    --border2: #162032; --border-ac: rgba(59,130,246,0.4);
    --ac: #3b82f6; --ac-bright: #60a5fa; --ac-dim: rgba(59,130,246,0.12);
    --ac-hover: #2563eb; --ok: #10b981; --ok-dim: rgba(16,185,129,0.1);
    --ok-border: rgba(16,185,129,0.3); --warn: #f59e0b;
    --warn-dim: rgba(245,158,11,0.1); --warn-border: rgba(245,158,11,0.3);
    --danger: #ef4444; --danger-dim: rgba(239,68,68,0.1);
    --danger-border: rgba(239,68,68,0.3); --text: #f0f6ff;
    --text2: #94a3b8; --text3: #64748b; --text4: #334155;
    --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 20px; --r-full: 9999px;
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4); --shadow-xl: 0 20px 60px rgba(0,0,0,0.6);
    --t: all 0.18s cubic-bezier(0.4,0,0.2,1);
  }
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .p-root { min-height:100vh; width:100%; background:var(--bg); color:var(--text); overflow-x:hidden; display:flex; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif; -webkit-font-smoothing:antialiased; }
  .p-wrap { width:100%; max-width:480px; padding:0 14px 48px; padding-top:env(safe-area-inset-top,0px); overflow-x:hidden; }
  .back-btn { display:inline-flex; align-items:center; gap:6px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:8px 16px; font-size:13px; font-weight:600; color:var(--text2); cursor:pointer; margin-top:12px; margin-bottom:14px; transition:var(--t); font-family:inherit; }
  .back-btn:hover { color:var(--text); border-color:var(--border-ac); background:var(--card2); }
  .hdr-card { background:linear-gradient(135deg,var(--card) 0%,var(--bg2) 100%); border-radius:var(--r-xl); border:1px solid var(--border); padding:18px; box-shadow:var(--shadow-md); position:relative; overflow:hidden; }
  .hdr-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--ac),#8b5cf6,var(--ok)); border-radius:var(--r-xl) var(--r-xl) 0 0; }
  .hdr-logo { width:36px; height:36px; background:linear-gradient(135deg,var(--ac),#1d4ed8); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; box-shadow:0 0 20px rgba(59,130,246,0.3); }
  .hdr-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.8px; line-height:1; }
  .hdr-title span { color:var(--ac-bright); }
  .hdr-sub { font-size:11px; color:var(--text3); margin-top:3px; }
  .loc-badge { background:var(--ac-dim); border:1px solid var(--border-ac); border-radius:var(--r-md); padding:8px 12px; text-align:right; flex-shrink:0; min-width:140px; max-width:160px; }
  .loc-lbl { font-size:9px; color:var(--text3); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:2px; }
  .loc-name { font-size:12px; font-weight:800; color:var(--ac-bright); word-break:break-word; line-height:1.3; }
  .lock-btn { width:100%; margin-top:10px; border-radius:var(--r-md); padding:9px 14px; font-size:12px; font-weight:800; cursor:pointer; border:1px solid; display:flex; align-items:center; justify-content:center; gap:7px; transition:var(--t); letter-spacing:0.3px; font-family:inherit; }
  .lock-btn.locked { background:var(--danger-dim); color:#fca5a5; border-color:var(--danger-border); }
  .lock-btn.locked:hover { background:rgba(239,68,68,0.18); }
  .lock-btn.unlocked { background:var(--ok-dim); color:#6ee7b7; border-color:var(--ok-border); }
  .lock-btn.unlocked:hover { background:rgba(16,185,129,0.18); }
  .tab-bar { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:14px; background:var(--bg); border-radius:var(--r-md); padding:4px; border:1px solid var(--border2); }
  .tab-btn { border-radius:9px; padding:9px 4px; font-size:12px; font-weight:800; cursor:pointer; border:1px solid transparent; transition:var(--t); text-align:center; letter-spacing:0.2px; font-family:inherit; }
  .tab-btn.on { background:var(--ac); color:#fff; border-color:var(--ac); box-shadow:0 2px 10px rgba(59,130,246,0.35); }
  .tab-btn.off { background:transparent; color:var(--text3); }
  .tab-btn.off:hover { color:var(--text); background:var(--surface); }
  .c-card { background:var(--card); border-radius:var(--r-xl); border:1px solid var(--border); padding:18px; margin-top:12px; box-shadow:0 1px 3px rgba(0,0,0,0.4); }
  .c-inner { background:var(--surface); border-radius:var(--r-lg); border:1px solid var(--border); padding:14px; }
  .c-sm { background:var(--surface); border-radius:var(--r-md); border:1px solid var(--border); padding:12px; }
  .c-deep { background:rgba(0,0,0,0.3); border-radius:var(--r-md); border:1px solid var(--border2); padding:12px; }
  .c-panel { background:rgba(0,0,0,0.25); border-radius:var(--r-md); border:1px solid var(--border2); padding:12px; }
  .s-lbl { font-size:10px; font-weight:800; color:var(--text3); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px; }
  .s-title { font-size:14px; font-weight:800; color:var(--text); margin-bottom:4px; letter-spacing:-0.2px; }
  .s-desc { font-size:12px; color:var(--text2); margin-bottom:12px; line-height:1.5; }
  .alert-danger { background:var(--danger-dim); border:1px solid var(--danger-border); border-radius:var(--r-lg); padding:14px; margin-bottom:14px; }
  .alert-warn { background:var(--warn-dim); border:1px solid var(--warn-border); border-radius:var(--r-lg); padding:14px; }
  .alert-danger .t { font-size:13px; font-weight:800; color:#fca5a5; }
  .alert-warn .t { font-size:13px; font-weight:800; color:#fcd34d; }
  .alert-danger .b { font-size:12px; color:rgba(252,165,165,0.8); margin-top:3px; line-height:1.5; }
  .alert-warn .b { font-size:12px; color:rgba(252,211,77,0.8); margin-top:3px; line-height:1.5; }
  .tog-wrap-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
  .tog-wrap-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px; }
  .tog { border-radius:var(--r-md); padding:11px 8px; font-size:12px; font-weight:800; cursor:pointer; border:1.5px solid; transition:var(--t); text-align:center; letter-spacing:0.3px; font-family:inherit; }
  .tog.on { background:var(--ac); color:#fff; border-color:var(--ac); box-shadow:0 2px 8px rgba(59,130,246,0.3); }
  .tog.off { background:var(--surface); color:var(--text3); border-color:var(--border); }
  .tog.off:hover { color:var(--text); border-color:var(--border-ac); }
  .tog.on-red { background:var(--danger-dim); color:#fca5a5; border-color:var(--danger-border); }
  .tog.on-yel { background:var(--warn-dim); color:#fcd34d; border-color:var(--warn-border); }
  .mode-row { display:flex; gap:8px; margin-top:10px; }
  .mode-btn { flex:1; border-radius:var(--r-md); padding:12px; font-size:14px; font-weight:900; cursor:pointer; border:1.5px solid; transition:var(--t); letter-spacing:0.5px; font-family:inherit; }
  .mode-use.on { background:rgba(239,68,68,0.12); color:#fca5a5; border-color:rgba(239,68,68,0.5); }
  .mode-rst.on { background:rgba(16,185,129,0.12); color:#6ee7b7; border-color:rgba(16,185,129,0.5); }
  .mode-btn.off { background:var(--surface); color:var(--text4); border-color:var(--border); }
  .lk-row { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:12px; }
  .lk-tab { border-radius:var(--r-md); padding:10px 4px; font-size:11px; font-weight:800; cursor:pointer; border:1px solid; transition:var(--t); text-align:center; letter-spacing:0.3px; font-family:inherit; }
  .lk-tab.on { background:var(--ac-dim); color:var(--ac-bright); border-color:var(--border-ac); }
  .lk-tab.off { background:var(--surface); color:var(--text3); border-color:var(--border); }
  .lk-tab.off:hover { color:var(--text); border-color:var(--border-ac); }
  .srch-row { display:flex; gap:8px; margin-top:10px; align-items:stretch; }
  .srch-wrap { flex:1; position:relative; display:flex; align-items:center; }
  .srch-inp { width:100%; border-radius:var(--r-md); border:1.5px solid var(--border); background:var(--input-bg); color:var(--text); padding:12px 50px 12px 14px; font-size:14px; font-family:inherit; outline:none; transition:var(--t); }
  .srch-inp:focus { border-color:var(--ac); box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  .srch-inp::placeholder { color:var(--text4); }
  .cam-btn { position:absolute; right:8px; top:50%; transform:translateY(-50%); background:var(--ac-dim); border:1px solid var(--border-ac); border-radius:var(--r-sm); padding:6px 10px; cursor:pointer; font-size:16px; transition:var(--t); line-height:1; }
  .cam-btn:hover { background:rgba(59,130,246,0.2); }
  .inp { width:100%; border-radius:var(--r-md); border:1px solid var(--border); background:var(--input-bg); color:var(--text); padding:11px 14px; font-size:13px; font-family:inherit; outline:none; transition:var(--t); }
  .inp:focus { border-color:var(--ac); box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  .inp::placeholder { color:var(--text4); }
  .inp-ta { min-height:80px; resize:vertical; line-height:1.5; }
  .inp-sel { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:36px; }
  .f-lbl { font-size:10px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; display:block; }
  .field { margin-bottom:10px; }
  .field:last-child { margin-bottom:0; }
  .pin-inp { width:100%; border-radius:var(--r-md); border:1.5px solid var(--border); background:var(--input-bg); color:var(--text); padding:14px; font-size:18px; font-family:inherit; outline:none; text-align:center; letter-spacing:6px; transition:var(--t); margin-top:10px; }
  .pin-inp:focus { border-color:var(--ac); box-shadow:0 0 0 3px rgba(59,130,246,0.12); }
  .btn { border-radius:var(--r-md); padding:11px 18px; font-size:13px; font-weight:800; cursor:pointer; border:none; transition:var(--t); display:inline-flex; align-items:center; justify-content:center; gap:6px; letter-spacing:0.2px; font-family:inherit; white-space:nowrap; }
  .btn:disabled { opacity:0.35; cursor:not-allowed; pointer-events:none; }
  .btn-ac { background:var(--ac); color:#fff; box-shadow:0 2px 8px rgba(59,130,246,0.25); }
  .btn-ac:hover:not(:disabled) { background:var(--ac-hover); box-shadow:0 4px 16px rgba(59,130,246,0.35); transform:translateY(-1px); }
  .btn-ok { background:var(--ok); color:#fff; }
  .btn-ok:hover:not(:disabled) { background:#059669; }
  .btn-err { background:var(--danger); color:#fff; }
  .btn-err:hover:not(:disabled) { background:#dc2626; }
  .btn-gh { background:var(--surface); color:var(--text2); border:1px solid var(--border); }
  .btn-gh:hover:not(:disabled) { color:var(--text); border-color:var(--border-ac); background:var(--card2); }
  .btn-warn { background:var(--warn-dim); color:#fcd34d; border:1px solid var(--warn-border); }
  .btn-warn:hover:not(:disabled) { background:rgba(245,158,11,0.18); }
  .btn-submit { background:linear-gradient(135deg,var(--ac) 0%,#1d4ed8 100%); color:#fff; box-shadow:0 4px 20px rgba(59,130,246,0.3); font-size:16px; font-weight:900; letter-spacing:0.5px; }
  .btn-submit:hover:not(:disabled) { box-shadow:0 6px 28px rgba(59,130,246,0.45); transform:translateY(-1px); }
  .btn-full { width:100%; }
  .btn-sm { padding:7px 13px; font-size:11px; border-radius:var(--r-sm); }
  .btn-lg { padding:14px 22px; font-size:15px; border-radius:var(--r-lg); letter-spacing:0.4px; }
  .qty-row { display:flex; align-items:center; gap:10px; margin-top:14px; }
  .qty-btn { width:46px; height:46px; border-radius:var(--r-md); background:var(--surface); border:1px solid var(--border); color:var(--text); font-size:22px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:var(--t); flex-shrink:0; font-family:inherit; }
  .qty-btn:hover { border-color:var(--ac); color:var(--ac-bright); background:var(--ac-dim); }
  .qty-disp { flex:1; border-radius:var(--r-md); background:var(--surface); border:1px solid var(--border); padding:12px 8px; text-align:center; font-size:20px; font-weight:800; color:var(--text); letter-spacing:-0.5px; }
  .item-card { border-radius:var(--r-lg); border:1px solid var(--border); padding:14px; cursor:pointer; transition:var(--t); background:var(--card); text-align:left; width:100%; position:relative; overflow:hidden; }
  .item-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:var(--r-lg) 0 0 var(--r-lg); }
  .item-card.low::before { background:var(--danger); }
  .item-card.warn::before { background:var(--warn); }
  .item-card.ok::before { background:var(--ok); }
  .item-card:hover { border-color:var(--border-ac); background:var(--card2); transform:translateY(-1px); box-shadow:var(--shadow-md); }
  .item-card:active { transform:translateY(0); }
  .i-name { font-size:14px; font-weight:700; color:var(--text); word-break:break-word; line-height:1.4; }
  .i-meta { font-size:11px; color:var(--text2); margin-top:3px; line-height:1.4; }
  .i-status { font-size:10px; color:var(--text3); margin-top:2px; }
  .oh-badge { border-radius:var(--r-md); padding:10px 14px; text-align:center; flex-shrink:0; margin-left:12px; }
  .oh-badge.low { background:var(--danger-dim); border:1px solid var(--danger-border); }
  .oh-badge.ok { background:var(--surface); border:1px solid var(--border); }
  .oh-num { font-size:22px; font-weight:900; letter-spacing:-1px; line-height:1; }
  .oh-num.low { color:var(--danger); }
  .oh-num.ok { color:var(--text); }
  .oh-unit { font-size:9px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.4px; margin-top:2px; }
  .stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:10px; }
  .stat-pill { background:var(--surface); border-radius:var(--r-sm); padding:8px 6px; border:1px solid var(--border); text-align:center; }
  .stat-pill.wb { background:rgba(245,158,11,0.06); border-color:rgba(245,158,11,0.3); }
  .stat-lbl { font-size:9px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.4px; }
  .stat-val { font-size:14px; font-weight:800; color:var(--text); margin-top:2px; letter-spacing:-0.3px; }
  .stat-val.w { color:#fcd34d; }
  .s-bar { border-radius:var(--r-md); padding:11px 14px; font-size:13px; font-weight:600; margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:10px; line-height:1.4; }
  .s-bar.ok { background:var(--ok-dim); border:1px solid var(--ok-border); color:#6ee7b7; }
  .s-bar.err { background:var(--danger-dim); border:1px solid var(--danger-border); color:#fca5a5; }
  .s-bar.info { background:var(--ac-dim); border:1px solid var(--border-ac); color:#93c5fd; }
  .s-bar.neutral { background:var(--surface); border:1px solid var(--border); color:var(--text2); }
  .found-panel { background:var(--surface); border-radius:var(--r-lg); border:1px solid var(--border-ac); padding:14px; margin-top:12px; position:relative; overflow:hidden; }
  .found-panel::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,var(--ac),transparent); }
  .f-name { font-size:15px; font-weight:800; color:var(--text); word-break:break-word; line-height:1.4; }
  .f-meta { font-size:11px; color:var(--text2); margin-top:3px; line-height:1.5; }
  .ov-btn { flex-shrink:0; border-radius:var(--r-md); padding:12px 16px; background:var(--surface); border:1.5px solid var(--border); cursor:pointer; text-align:center; transition:var(--t); min-width:90px; font-family:inherit; }
  .ov-btn.on { background:var(--warn-dim); border-color:var(--warn-border); }
  .ov-btn:hover { border-color:var(--warn-border); }
  .ov-icon { font-size:18px; line-height:1; }
  .ov-lbl { font-size:11px; font-weight:800; letter-spacing:0.3px; }
  .ov-lbl.on { color:#fcd34d; }
  .ov-lbl.off { color:var(--text3); }
  .sug-item { background:var(--card); border-radius:var(--r-md); border:1px solid var(--border); padding:12px 14px; cursor:pointer; width:100%; text-align:left; transition:var(--t); font-family:inherit; display:block; }
  .sug-item:hover { border-color:var(--border-ac); background:var(--card2); }
  .sug-name { font-size:13px; font-weight:700; color:var(--text); word-break:break-word; }
  .sug-meta { font-size:11px; color:var(--text2); margin-top:3px; }
  .sug-status { font-size:10px; color:var(--text3); margin-top:2px; }
  .badge { display:inline-flex; align-items:center; padding:3px 9px; border-radius:var(--r-full); font-size:10px; font-weight:800; letter-spacing:0.3px; }
  .notes-txt { font-size:10px; color:var(--text3); margin-top:6px; line-height:1.5; word-break:break-word; }
  .edit-hint { font-size:10px; color:var(--text3); margin-top:5px; opacity:0.7; }
  .zero-warn { font-size:11px; font-weight:800; color:#fcd34d; margin-top:7px; display:flex; align-items:center; gap:4px; }
  .pin-hint { font-size:11px; color:var(--text4); margin-top:8px; line-height:1.5; }
  .divider { height:1px; background:var(--border); margin:14px 0; }
  .audit-card { background:var(--card); border-radius:var(--r-md); border:1px solid var(--border); padding:12px; }
  .audit-hdr { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; }
  .audit-act { display:inline-flex; align-items:center; padding:2px 9px; border-radius:var(--r-full); font-size:10px; font-weight:800; letter-spacing:0.3px; }
  .audit-time { font-size:10px; color:var(--text4); flex-shrink:0; }
  .audit-stf { font-size:12px; color:var(--text2); }
  .audit-stf strong { color:var(--text); font-weight:700; }
  .audit-det { font-size:11px; color:var(--text4); margin-top:3px; word-break:break-word; line-height:1.5; }
  .ord-card { background:var(--card); border-radius:var(--r-md); border:1px solid var(--border); padding:12px; }
  .ord-vend { font-size:14px; font-weight:700; color:var(--text); word-break:break-word; }
  .ord-po { font-size:11px; color:var(--text2); margin-top:2px; }
  .ord-exp { font-size:11px; color:var(--text2); margin-top:8px; }
  .ord-notes { font-size:11px; color:var(--text4); margin-top:4px; word-break:break-word; }
  .modal-ov { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; }
  .modal { width:100%; max-width:460px; max-height:92vh; overflow-y:auto; background:var(--card); border-radius:var(--r-xl); border:1px solid var(--border); padding:22px; box-shadow:var(--shadow-xl); position:relative; }
  .modal::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--ac),#8b5cf6); border-radius:var(--r-xl) var(--r-xl) 0 0; }
  .modal-title { font-size:17px; font-weight:900; color:var(--text); margin-bottom:16px; letter-spacing:-0.3px; }
  .modal-footer { display:flex; gap:10px; position:sticky; bottom:0; background:var(--card); padding-top:14px; margin-top:18px; border-top:1px solid var(--border); }
  .scan-ov { position:fixed; inset:0; z-index:200; background:#000; display:flex; flex-direction:column; }
  .scan-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; padding-top:calc(env(safe-area-inset-top,0px) + 14px); background:rgba(0,0,0,0.6); border-bottom:1px solid rgba(255,255,255,0.1); }
  .scan-title { font-size:17px; font-weight:800; color:#fff; letter-spacing:-0.3px; }
  .scan-close { background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:var(--r-md); padding:8px 16px; color:#fff; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:var(--t); }
  .scan-close:hover { background:rgba(255,255,255,0.18); }
  .scan-vp { flex:1; position:relative; overflow:hidden; }
  .scan-vid { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .scan-frame { pointer-events:none; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .scan-box { width:300px; height:190px; border-radius:18px; border:2px solid rgba(59,130,246,0.85); box-shadow:0 0 0 9999px rgba(0,0,0,0.5),0 0 30px rgba(59,130,246,0.3); position:relative; }
  .scan-box::before,.scan-box::after { content:''; position:absolute; width:24px; height:24px; border-color:var(--ac); border-style:solid; }
  .scan-box::before { top:-2px; left:-2px; border-width:3px 0 0 3px; border-radius:18px 0 0 0; }
  .scan-box::after { bottom:-2px; right:-2px; border-width:0 3px 3px 0; border-radius:0 0 18px 0; }
  .scan-hint { padding:12px 16px; padding-bottom:calc(env(safe-area-inset-bottom,0px) + 16px); font-size:12px; color:rgba(255,255,255,0.6); background:rgba(0,0,0,0.6); text-align:center; }
  .area-hdr { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
  .area-title { font-size:15px; font-weight:800; color:var(--text); letter-spacing:-0.3px; }
  .area-count { font-size:11px; color:var(--text4); background:var(--surface); border:1px solid var(--border); border-radius:var(--r-full); padding:2px 9px; font-weight:600; }
  .tot-hdr { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
  .tot-title { font-size:17px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
  .tot-count { font-size:12px; color:var(--text4); font-weight:600; }
  .chk-row { display:flex; align-items:center; gap:9px; font-size:13px; color:var(--text); cursor:pointer; padding:6px 0; }
  .chk-row input[type="checkbox"] { width:16px; height:16px; cursor:pointer; accent-color:var(--ac); }
  .mt2{margin-top:8px} .mt3{margin-top:12px} .mt4{margin-top:16px}
  .mb2{margin-bottom:8px} .mb3{margin-bottom:12px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .fx{display:flex;align-items:center;gap:10px}
  .fxb{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .sp>*+*{margin-top:10px}
  .w100{width:100%} .s0{flex-shrink:0} .brk{word-break:break-word}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .anim{animation:fadeUp 0.22s cubic-bezier(0.4,0,0.2,1) both}
  .src-hosp{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-sm);font-size:10px;font-weight:700;background:rgba(16,185,129,0.12);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .src-vend{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-sm);font-size:10px;font-weight:700;background:rgba(245,158,11,0.1);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .src-both{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-sm);font-size:10px;font-weight:700;background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);}
`;

function auditStyle(action: string): React.CSSProperties {
  const m: Record<string,React.CSSProperties> = {
    SUBMIT_TX:{background:"rgba(59,130,246,0.15)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)"},UNDO_TX:{background:"rgba(245,158,11,0.15)",color:"#fcd34d",border:"1px solid rgba(245,158,11,0.3)"},TOTALS_SET:{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"},TOTALS_ADJUST:{background:"rgba(245,158,11,0.15)",color:"#fcd34d",border:"1px solid rgba(245,158,11,0.3)"},UNLOCK:{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"},LOCK:{background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)"},ADD_ITEM:{background:"rgba(59,130,246,0.15)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)"},ITEM_INACTIVE:{background:"rgba(245,158,11,0.15)",color:"#fcd34d",border:"1px solid rgba(245,158,11,0.3)"},ITEM_RESTORED:{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"},ITEM_STATUS_SAVE:{background:"rgba(59,130,246,0.15)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)"},AREA_ROW_EDIT_SAVE:{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"},SCAN:{background:"rgba(139,92,246,0.15)",color:"#c4b5fd",border:"1px solid rgba(139,92,246,0.3)"},LOOKUP_FOUND:{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"},LOOKUP_NOT_FOUND:{background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)"},CHANGE_LOCATION:{background:"rgba(59,130,246,0.15)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)"},MAIN_OVERRIDE_ON:{background:"rgba(245,158,11,0.15)",color:"#fcd34d",border:"1px solid rgba(245,158,11,0.3)"},MAIN_OVERRIDE_OFF:{background:"rgba(100,116,139,0.15)",color:"#94a3b8",border:"1px solid rgba(100,116,139,0.3)"},
  };
  return m[action]??{background:"rgba(100,116,139,0.15)",color:"#94a3b8",border:"1px solid rgba(100,116,139,0.3)"};
}
function statusClass(s:string):string { if(!s||s==="Ready."||s==="Stopped.")return "neutral"; if(s.startsWith("✅")||s.startsWith("↩️")||s.startsWith("Found:")||s.startsWith("Added:")||s.startsWith("Selected:")||s.startsWith("Saved"))return "ok"; if(s.startsWith("NOT FOUND")||s.toLowerCase().includes("failed")||s.toLowerCase().includes("error")||s==="Camera blocked.")return "err"; if(s.startsWith("Multiple")||s.startsWith("Looking")||s.startsWith("Starting")||s.startsWith("Scanning"))return "info"; return "neutral"; }

function OrderStatusList({rows}:{rows:OrderStatusRow[]}) {
  return (<div className="sp">{rows.map((row)=>{const pending=Math.max((row.qty_ordered??0)-(row.qty_received??0),0);const bs:React.CSSProperties=row.status==="RECEIVED"?{background:"rgba(16,185,129,0.15)",color:"#6ee7b7",border:"1px solid rgba(16,185,129,0.3)"}:row.status==="BACKORDER"||row.status==="CANCELLED"?{background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)"}:row.status==="PARTIAL"?{background:"rgba(245,158,11,0.15)",color:"#fcd34d",border:"1px solid rgba(245,158,11,0.3)"}:{background:"rgba(59,130,246,0.15)",color:"#93c5fd",border:"1px solid rgba(59,130,246,0.3)"};return(<div key={row.id} className="ord-card" style={{marginTop:10}}><div className="fxb" style={{marginBottom:10}}><div style={{minWidth:0}}><div className="ord-vend">{row.purchase_orders?.vendor||"Unknown vendor"}</div><div className="ord-po">PO: {row.purchase_orders?.po_number||"—"}</div></div><span className="badge" style={{...bs,flexShrink:0}}>{row.status}</span></div><div className="stats-row">{[["Ordered",row.qty_ordered??0],["Received",row.qty_received??0],["Pending",pending]].map(([l,v])=>(<div key={String(l)} className="stat-pill"><div className="stat-lbl">{l}</div><div className="stat-val">{v}</div></div>))}</div><div className="ord-exp">Expected: {row.purchase_orders?.expected_date||"—"}</div>{(row.notes||row.purchase_orders?.notes)&&<div className="ord-notes">Notes: {row.notes||row.purchase_orders?.notes}</div>}</div>);})}</div>);
}
function AscModal({title,children,okText,onOk,onCancel}:{title:string;children:React.ReactNode;okText:string;onOk:()=>void;onCancel:()=>void;}){return(<div className="modal-ov"><div className="modal anim"><div className="modal-title">{title}</div><div>{children}</div><div className="modal-footer"><button onClick={onCancel} className="btn btn-gh" style={{flex:1}}>Cancel</button><button onClick={onOk} className="btn btn-ac" style={{flex:1}}>{okText}</button></div></div></div>);}
function PinSetter({onSave}:{onSave:(pin:string)=>void}){const[pin,setPin]=useState("");return(<div><input value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} className="pin-inp" placeholder="New password" inputMode="numeric" type="password"/><button onClick={()=>onSave(pin)} className="btn btn-submit btn-full btn-lg" style={{marginTop:14}}>Save Password</button></div>);}
function TabBtn({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className={`tab-btn ${active?"on":"off"}`}>{children}</button>;}
function ModeBtn({active,danger,onClick,children}:{active:boolean;danger?:boolean;onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className={`mode-btn ${danger?"mode-use":"mode-rst"} ${active?"on":"off"}`}>{children}</button>;}
function QtyBtn({onClick,children}:{onClick:()=>void;children:React.ReactNode}){return <button type="button" onClick={onClick} className="qty-btn">{children}</button>;}

export default function InventoryPage() {
  const router = useRouter();
  useSessionTimeout();

  const [tab,setTab]=useState<Tab>("Transaction");
  const [mode,setMode]=useState<Mode>("USE");
  const [qty,setQty]=useState(1);
  const [mainOverride,setMainOverride]=useState(false);
  const [areas,setAreas]=useState<Area[]>([]);
  const [areaId,setAreaId]=useState("");
  const [areasLoading,setAreasLoading]=useState(true);
  const selectedAreaName=useMemo(()=>areas.find((a)=>a.id===areaId)?.name??"—",[areas,areaId]);
  const [locked,setLocked]=useState(true);
  const [pinOpen,setPinOpen]=useState(false);
  const [pinPurpose,setPinPurpose]=useState<"unlock"|"lock"|"changeLocation"|"addItem"|"totalsEdit"|"areaRowEdit"|"itemStatusEdit">("unlock");
  const [pinInput,setPinInput]=useState("");
  const [pendingArea,setPendingArea]=useState("");
  const [query,setQuery]=useState("");
  const [item,setItem]=useState<Item|null>(null);
  const [status,setStatus]=useState("");
  const [addOpen,setAddOpen]=useState(false);
  const [addName,setAddName]=useState("");
  const [addPar,setAddPar]=useState<number>(0);
  const [lookupMode,setLookupMode]=useState<LookupMode>("BARCODE");
  const [matches,setMatches]=useState<Item[]>([]);
  const [suggestLoading,setSuggestLoading]=useState(false);
  const [staffName,setStaffName]=useState("");
  const [audit,setAudit]=useState<AuditEvent[]>([]);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [totals,setTotals]=useState<BuildingTotalRow[]>([]);
  const [totalsLoading,setTotalsLoading]=useState(false);
  const [totalsError,setTotalsError]=useState("");
  const [totalsSearch,setTotalsSearch]=useState("");
  const [totalsLowOnly,setTotalsLowOnly]=useState(false);
  const [totalsZeroOnly,setTotalsZeroOnly]=useState(false);
  const [totalsShowInactive,setTotalsShowInactive]=useState(false);
  const [totalsEditOpen,setTotalsEditOpen]=useState(false);
  const [totalsEditRow,setTotalsEditRow]=useState<BuildingTotalRow|null>(null);
  const [setOnHandInput,setSetOnHandInput]=useState<string>("");
  const [deltaInput,setDeltaInput]=useState<string>("");
  const [parInput,setParInput]=useState<string>("");
  const [vendorInput,setVendorInput]=useState<string>("");
  const [categoryInput,setCategoryInput]=useState<string>("");
  const [unitInput,setUnitInput]=useState<string>("");
  const [notesInput,setNotesInput]=useState<string>("");
  const [totalsLowInput,setTotalsLowInput]=useState<string>("");
  const [refInput,setRefInput]=useState<string>("");
  const [totalsOrderStatusInput,setTotalsOrderStatusInput]=useState<string>("IN STOCK");
  const [totalsBackorderedInput,setTotalsBackorderedInput]=useState<boolean>(false);
  const [supplySourceInput,setSupplySourceInput]=useState<string>("VENDOR");
  const [priceInput,setPriceInput]=useState<string>("");
  const [expirationInput,setExpirationInput]=useState<string>("");
  const [pendingTotalsAction,setPendingTotalsAction]=useState<null|{kind:"SET";value:number}|{kind:"ADJUST";delta:number}|{kind:"SET_ACTIVE";is_active:boolean}>(null);
  const [areaListOpen,setAreaListOpen]=useState(false);
  const [areaInv,setAreaInv]=useState<AreaInvRow[]>([]);
  const [areaInvLoading,setAreaInvLoading]=useState(false);
  const [areaInvError,setAreaInvError]=useState("");
  const [areaInvSearch,setAreaInvSearch]=useState("");
  const [areaParOnly,setAreaParOnly]=useState(false);
  const [areaLowOnly,setAreaLowOnly]=useState(false);
  const [areaEditOpen,setAreaEditOpen]=useState(false);
  const [areaEditRow,setAreaEditRow]=useState<AreaInvRow|null>(null);
  const [areaEditOnHand,setAreaEditOnHand]=useState<string>("");
  const [areaEditPar,setAreaEditPar]=useState<string>("");
  const [areaEditLow,setAreaEditLow]=useState<string>("");
  const [pendingAreaRowSave,setPendingAreaRowSave]=useState<null|{storage_area_id:string;item_id:string;on_hand:number|null;par_level:number|null;low_level:number|null;}>(null);
  const [lastTx,setLastTx]=useState<LastTx|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [undoBusy,setUndoBusy]=useState(false);
  const [orderStatusOpen,setOrderStatusOpen]=useState(false);
  const [orderStatusLoading,setOrderStatusLoading]=useState(false);
  const [orderStatusRows,setOrderStatusRows]=useState<OrderStatusRow[]>([]);
  const [totalsOrderLoading,setTotalsOrderLoading]=useState(false);
  const [totalsOrderRows,setTotalsOrderRows]=useState<OrderStatusRow[]>([]);
  const [itemStatusSaving,setItemStatusSaving]=useState(false);
  const [itemStatusDraft,setItemStatusDraft]=useState<{order_status:string;backordered:boolean}>({order_status:"IN STOCK",backordered:false});
  const [pendingItemStatusSave,setPendingItemStatusSave]=useState<null|{item_id:string;order_status:string;backordered:boolean;item_name?:string;}>(null);
  const [orderPinOpen, setOrderPinOpen] = useState(false);
  const [orderPinInput, setOrderPinInput] = useState("");
  const [orderPinError, setOrderPinError] = useState(false);
  const ORDER_PIN = "1620";
  const [orderReqOpen, setOrderReqOpen] = useState(false);
  const [orderReqItems, setOrderReqItems] = useState<Record<string,number|string>>({});
  const [orderReqSending, setOrderReqSending] = useState(false);
  const [orderReqDone, setOrderReqDone] = useState(false);
  const [orderReqSearch, setOrderReqSearch] = useState("");
  const [orderReqLowOnly, setOrderReqLowOnly] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const readerRef=useRef<BrowserMultiFormatReader|null>(null);
  const lastScanRef=useRef<string>("");
  const scanCooldownRef=useRef<number>(0);

  const filteredTotals=useMemo(()=>{const q=totalsSearch.trim().toLowerCase();let list=totals.filter((r)=>totalsShowInactive?!r.is_active:!!r.is_active);if(q)list=list.filter((r)=>(r.name||"").toLowerCase().includes(q)||(r.vendor||"").toLowerCase().includes(q)||(r.category||"").toLowerCase().includes(q)||(r.reference_number||"").toLowerCase().includes(q)||(r.order_status||"").toLowerCase().includes(q));if(totalsLowOnly)list=list.filter((r)=>{const oh=r.total_on_hand??0;const low=r.low_level??0;return low>0&&oh<=low;});if(totalsZeroOnly)list=list.filter((r)=>(r.par_level??0)===0||(r.low_level??0)===0);return list;},[totals,totalsSearch,totalsLowOnly,totalsZeroOnly,totalsShowInactive]);
  const filteredAreaInv=useMemo(()=>{const q=areaInvSearch.trim().toLowerCase();let list=areaInv;if(q)list=list.filter((r)=>(r.item_name||"").toLowerCase().includes(q)||(r.vendor||"").toLowerCase().includes(q)||(r.category||"").toLowerCase().includes(q)||(r.reference_number||"").toLowerCase().includes(q)||(r.order_status||"").toLowerCase().includes(q));if(areaParOnly)list=list.filter((r)=>(r.par_level??0)>0);if(areaLowOnly)list=list.filter((r)=>{const oh=r.on_hand??0;const low=r.low_level??0;return low>0&&oh<=low;});return list;},[areaInv,areaInvSearch,areaParOnly,areaLowOnly]);

  // Check session on load
  useEffect(()=>{
    try{
      setLocked(!getSessionUnlocked());
      const savedArea=localStorage.getItem(LS.AREA);
      if(savedArea)setAreaId(savedArea);
      setAudit(safeJsonParse<AuditEvent[]>(localStorage.getItem(LS.AUDIT),[]));
      setLastTx(safeJsonParse<LastTx|null>(localStorage.getItem(LS.LAST_TX),null));
    }catch{}
    supabase.auth.getSession().then(({data})=>{
      if(data.session?.user){
        const name = data.session.user.user_metadata?.full_name || data.session.user.email || "";
        if(name){
          setStaffName(name);
          try{localStorage.setItem(LS.STAFF,name);}catch{}
        } else {
          const savedName=localStorage.getItem(LS.STAFF)||"";
          setStaffName(savedName);
          if(!savedName.trim())setNamePromptOpen(true);
        }
      }
    });
  },[]);// eslint-disable-line

  useEffect(()=>{try{if(areaId)localStorage.setItem(LS.AREA,areaId);}catch{}},[areaId]);
  useEffect(()=>{try{localStorage.setItem(LS.STAFF,staffName);}catch{}},[staffName]);
  useEffect(()=>{try{localStorage.setItem(LS.AUDIT,JSON.stringify(audit.slice(0,500)));}catch{}},[audit]);
  useEffect(()=>{try{localStorage.setItem(LS.LAST_TX,JSON.stringify(lastTx));}catch{}},[lastTx]);

  // When staff name changes, clean up old presence row
  useEffect(()=>{
    if(!staffName.trim())return;
    const prevName = typeof localStorage !== "undefined" ? localStorage.getItem("asc_prev_staff_name") : null;
    if(prevName && prevName !== staffName.trim()){
      Promise.resolve(supabase.from("staff_presence").delete().eq("staff", prevName)).catch(()=>{});
    }
    try{localStorage.setItem("asc_prev_staff_name", staffName.trim());}catch{}
  },[staffName]);// eslint-disable-line
  useEffect(()=>{
    if(!staffName.trim())return;
    async function sendHeartbeat(){
      await Promise.resolve(supabase.from("staff_presence").upsert({
        staff:staffName.trim(),
        last_seen:new Date().toISOString(),
        area_name:selectedAreaName??null,
        device_info:typeof navigator!=="undefined"?navigator.userAgent.slice(0,120):null,
      },{onConflict:"staff"})).catch(()=>{});
    }
    sendHeartbeat();
    const interval=setInterval(sendHeartbeat,30000);
    return()=>clearInterval(interval);
  },[staffName,selectedAreaName]);// eslint-disable-line

  function pushAudit(ev:Omit<AuditEvent,"id"|"ts"|"staff">){const staff=(staffName||"").trim()||"Unknown";const ts=nowIso();setAudit((prev)=>[{id:uid(),ts,staff,action:ev.action,details:ev.details},...prev].slice(0,500));Promise.resolve(supabase.from("audit_log").insert({staff,action:ev.action,details:ev.details??null,area_name:selectedAreaName??null,device_info:typeof navigator!=="undefined"?navigator.userAgent.slice(0,120):null})).then(()=>{}).catch(()=>{});}

  async function loadLocations(){setAreasLoading(true);try{const res=await fetch("/api/locations",{method:"GET",cache:"no-store",headers:{"Cache-Control":"no-cache"}});const json=await res.json();if(!json.ok){setStatus(`Locations error: ${json.error}`);setAreas([]);setAreaId("");return;}const list:Area[]=json.locations??[];setAreas(list);setAreaId((prev)=>{if(!list.length)return"";return list.some((a)=>a.id===prev)?prev:list[0].id;});setStatus("");}catch(e:any){setStatus(`Locations fetch failed: ${e?.message??"unknown"}`);setAreas([]);setAreaId("");}finally{setAreasLoading(false);}}

  useEffect(()=>{loadLocations();},[]);// eslint-disable-line

  async function loadTotals(){setTotalsLoading(true);setTotalsError("");try{const{data,error}=await supabase.from("building_inventory_sheet_view").select("item_id,name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit,notes,is_active,order_status,backordered").order("name",{ascending:true});if(error)throw error;const rows=(data as BuildingTotalRow[])??[];const ids=rows.map((r)=>r.item_id);if(ids.length>0){const{data:srcData}=await supabase.from("items").select("id,supply_source,price,expiration_date").in("id",ids);if(srcData){const map=Object.fromEntries(srcData.map((r:any)=>[r.id,r]));rows.forEach((r)=>{r.supply_source=map[r.item_id]?.supply_source??null;r.price=map[r.item_id]?.price??null;r.expiration_date=map[r.item_id]?.expiration_date??null;});}}setTotals(rows);}catch(e:any){setTotals([]);setTotalsError(e?.message??"Failed to load totals");}finally{setTotalsLoading(false);}}
  useEffect(()=>{if(tab!=="Totals")return;if(totals.length===0)loadTotals();},[tab]);// eslint-disable-line

  async function loadAreaInventory(){if(!areaId)return;setAreaInvLoading(true);setAreaInvError("");try{const{data,error}=await supabase.from("storage_inventory_area_view").select("storage_area_id,storage_area_name,item_id,item_name,on_hand,par_level,low_level,unit,vendor,category,reference_number,notes,order_status,backordered").eq("storage_area_id",areaId).gt("par_level",0).order("item_name",{ascending:true});if(error)throw error;setAreaInv((data as AreaInvRow[])??[]);pushAudit({action:"AREA_LIST_LOAD",details:`Area=${selectedAreaName} Rows=${(data as any[])?.length??0}`});}catch(e:any){setAreaInv([]);setAreaInvError(e?.message??"Failed to load area list");}finally{setAreaInvLoading(false);}}

  useEffect(()=>{if(!scannerOpen)stopScanner();},[scannerOpen]);// eslint-disable-line
  useEffect(()=>{if(tab!=="Transaction"){stopScanner();setScannerOpen(false);}return()=>stopScanner();},[tab]);// eslint-disable-line
  useEffect(()=>{if(tab!=="Transaction"||!areaListOpen||!areaId)return;loadAreaInventory();},[tab,areaListOpen,areaId]);// eslint-disable-line

  async function startScanner(){if(!staffName.trim()){setStatus("No staff name — please log in again.");return;}setScannerOpen(true);pushAudit({action:"SCANNER_OPEN",details:`Area=${selectedAreaName}`});setStatus("Starting camera…");await new Promise((r)=>setTimeout(r,80));if(!videoRef.current){setStatus("Camera view not ready.");return;}stopScanner();try{const mod=await import("@zxing/browser");const Reader=mod.BrowserMultiFormatReader;const reader=new Reader();readerRef.current=reader;setStatus("Scanning…");pushAudit({action:"SCAN",details:`Area=${selectedAreaName}`});const constraints:MediaStreamConstraints={video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false};const stream=await navigator.mediaDevices.getUserMedia(constraints);const v:any=videoRef.current;v.srcObject=stream;await v.play();const decodeFromVideoElement=(reader as any).decodeFromVideoElement?.bind(reader);let scanFired=false;const handleText=async(text:string)=>{if(!text)return;if(scanFired)return;const now=Date.now();if(now<scanCooldownRef.current)return;scanCooldownRef.current=now+2000;scanFired=true;const cleaned=text.trim().replace(/[\r\n\t]/g,"");if(!cleaned)return;stopScannerCamera();setScannerOpen(false);setQuery(cleaned);setLookupMode("BARCODE");await lookup(cleaned);};if(decodeFromVideoElement){await decodeFromVideoElement(videoRef.current,async(result:any)=>{if(!result)return;await handleText(result.getText?.()??"");});}else{await reader.decodeFromVideoDevice(undefined,videoRef.current,async(result)=>{if(!result)return;await handleText(result.getText?.()??"");});}}catch{setScannerOpen(false);setStatus("Camera blocked.");alert("Camera blocked.\n\nOn iPhone:\nSettings → Safari → Camera → Allow\nThen refresh and try again.");}}
  function stopScannerCamera(){try{(readerRef.current as any)?.reset?.();}catch{}readerRef.current=null;try{const v=videoRef.current as any;const stream=v?.srcObject as MediaStream|null;if(stream){stream.getTracks().forEach((t)=>t.stop());v.srcObject=null;}}catch{}}
  function stopScanner(){try{(readerRef.current as any)?.reset?.();}catch{}readerRef.current=null;lastScanRef.current="";scanCooldownRef.current=0;try{const v=videoRef.current as any;const stream=v?.srcObject as MediaStream|null;if(stream){stream.getTracks().forEach((t)=>t.stop());v.srcObject=null;}}catch{}}
  function closeScanner(){stopScanner();setScannerOpen(false);pushAudit({action:"SCANNER_CLOSE"});setStatus("Stopped.");}
  function mapItemRow(r:any):Item{const itemObj=Array.isArray(r.items)?r.items[0]:r.items;return{id:r.id,name:r.name,barcode:r.barcode??"",reference_number:r.reference_number??null,order_status:r.order_status??itemObj?.order_status??"IN STOCK",backordered:r.backordered??itemObj?.backordered??false};}

  async function lookup(queryRaw:string){const q=queryRaw.trim();if(!q)return;setItem(null);setOrderStatusRows([]);setMatches([]);setStatus("Looking up…");const res=await fetch("/api/items/lookup",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({query:q,mode:lookupMode})});const json=await res.json();if(!json.ok){setStatus(`Lookup failed: ${json.error}`);return;}if(json.item){const it=mapItemRow(json.item);setItem(it);setItemStatusDraft({order_status:it.order_status||"IN STOCK",backordered:!!it.backordered});setStatus(`Found: ${it.name}`);pushAudit({action:"LOOKUP_FOUND",details:`Item=${it.name} Mode=${lookupMode} Query=${q}`});return;}const mapped=((json.matches??[])as any[]).map(mapItemRow);if(mapped.length){setMatches(mapped);setStatus("Multiple matches — tap one.");return;}setStatus("NOT FOUND — Add Item");pushAudit({action:"LOOKUP_NOT_FOUND",details:`Mode=${lookupMode} Query=${q}`});setAddOpen(true);setAddName("");}
  async function suggest(queryRaw:string){const q=queryRaw.trim();if(!q||lookupMode==="BARCODE"||q.length<2){setMatches([]);setSuggestLoading(false);return;}setSuggestLoading(true);try{const res=await fetch("/api/items/lookup",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({query:q,mode:lookupMode,suggest:true})});const json=await res.json();if(!json.ok){setMatches([]);setSuggestLoading(false);return;}if(json.item){setMatches([mapItemRow(json.item)]);setSuggestLoading(false);return;}setMatches(((json.matches??[])as any[]).map(mapItemRow).slice(0,8));}catch{setMatches([]);}finally{setSuggestLoading(false);}}
  useEffect(()=>{if(tab!=="Transaction"||areaListOpen||scannerOpen||addOpen||lookupMode==="BARCODE"){setSuggestLoading(false);return;}const t=window.setTimeout(()=>suggest(query),250);return()=>window.clearTimeout(t);},[query,lookupMode,tab,areaListOpen,scannerOpen,addOpen]);// eslint-disable-line

  function openPin(purpose:typeof pinPurpose){setPinPurpose(purpose);setPinInput("");setPinOpen(true);}
  function checkPin():boolean{return pinInput.trim()===(localStorage.getItem(LS.PIN)||"1234");}

  async function onPinConfirm(){if(!checkPin())return alert("Wrong PIN");setPinOpen(false);if(pinPurpose==="unlock"){setSessionUnlocked(true);setLocked(false);pushAudit({action:"UNLOCK",details:`Area=${selectedAreaName}`});return;}if(pinPurpose==="lock"){setSessionUnlocked(false);setLocked(true);pushAudit({action:"LOCK",details:`Area=${selectedAreaName}`});return;}if(pinPurpose==="changeLocation"){if(pendingArea){const nextName=areas.find((a)=>a.id===pendingArea)?.name??pendingArea;setAreaId(pendingArea);pushAudit({action:"CHANGE_LOCATION",details:`To=${nextName}`});}setPendingArea("");return;}if(pinPurpose==="addItem"){await addItemNow(true);return;}if(pinPurpose==="totalsEdit"){const action=pendingTotalsAction;setPendingTotalsAction(null);if(!action||!totalsEditRow)return;if(action.kind==="SET")await doTotalsSet(totalsEditRow,action.value,true);else if(action.kind==="ADJUST")await doTotalsAdjust(totalsEditRow,action.delta,true);else if(action.kind==="SET_ACTIVE")await doTotalsSetActive(totalsEditRow,action.is_active,true);return;}if(pinPurpose==="areaRowEdit"){const payload=pendingAreaRowSave;setPendingAreaRowSave(null);if(!payload)return;await saveAreaRow(payload,true);return;}if(pinPurpose==="itemStatusEdit"){const payload=pendingItemStatusSave;setPendingItemStatusSave(null);if(!payload)return;await doSaveItemStatus(payload.item_id,payload.order_status,payload.backordered,payload.item_name);return;}}
  function requestLocationChange(newId:string){if(!locked){const nextName=areas.find((a)=>a.id===newId)?.name??newId;setAreaId(newId);pushAudit({action:"CHANGE_LOCATION",details:`To=${nextName}`});return;}setPendingArea(newId);openPin("changeLocation");}
  async function addItemNow(pinAlreadyPassed=false){if(locked&&!pinAlreadyPassed){openPin("addItem");return;}const barcode=query.trim();if(!barcode)return alert("No barcode/value entered.");if(!addName.trim())return alert("Enter item name.");if(!areaId)return alert("Select a location.");const res=await fetch("/api/items/create",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({name:addName.trim(),barcode,storage_area_id:areaId,par_level:addPar})});const json=await res.json();if(!json.ok)return alert(`Add failed: ${json.error}`);const nextItem=mapItemRow(json.item);setItem(nextItem);setItemStatusDraft({order_status:nextItem.order_status||"IN STOCK",backordered:!!nextItem.backordered});setMatches([]);setAddOpen(false);setStatus(`Added: ${json.item.name}`);pushAudit({action:"ADD_ITEM",details:`Item=${json.item.name} Barcode=${barcode} Area=${selectedAreaName} Par=${addPar}`});}
  async function fetchOnHand(area:string,itemId:string):Promise<number>{const{data,error}=await supabase.from("storage_inventory").select("on_hand").eq("storage_area_id",area).eq("item_id",itemId).maybeSingle();if(error)throw error;return(data?.on_hand??0)as number;}

  async function submit(){if(submitting)return;if(locked){alert("🔒 App is locked.\n\nTap the 🔒 lock button at the top to unlock before submitting.");return;}if(!staffName.trim()){setTab("Audit");return alert("Enter staff name in Audit tab first.");}if(!item?.id)return alert("Find or scan an item first.");if(!areaId)return alert("Select a location.");setSubmitting(true);try{if(mode==="USE"){const useArea=mainOverride?MAIN_SUPPLY_ID:areaId;const{error}=await supabase.rpc("use_stock",{p_item_id:item.id,p_area_id:useArea,p_qty:qty});if(error)throw error;const newOnHand=await fetchOnHand(useArea,item.id);setLastTx({storage_area_id:useArea,mode,item_id:item.id,qty,mainOverride,item_name:item.name,area_name:useArea===MAIN_SUPPLY_ID?"MAIN SUPPLY":selectedAreaName,ts:nowIso()});setMainOverride(false);setQty(1);setStatus(`✅ Updated on-hand to ${newOnHand}`);if(tab==="Totals")await loadTotals();if(tab==="Transaction"&&areaListOpen)await loadAreaInventory();pushAudit({action:"SUBMIT_TX",details:`Mode=USE Qty=${qty} Item=${item.name} Area=${useArea===MAIN_SUPPLY_ID?"MAIN SUPPLY":selectedAreaName} Override=${mainOverride?"MAIN":"NO"}`});return;}if(mode==="RESTOCK"){const{error}=await supabase.rpc("move_stock",{p_item_id:item.id,p_from_area:MAIN_SUPPLY_ID,p_to_area:areaId,p_qty:qty});if(error)throw error;const newOnHand=await fetchOnHand(areaId,item.id);setLastTx({storage_area_id:areaId,mode,item_id:item.id,qty,mainOverride:false,item_name:item.name,area_name:selectedAreaName,ts:nowIso()});setMainOverride(false);setQty(1);setStatus(`✅ Restocked. On-hand now ${newOnHand}`);if(tab==="Totals")await loadTotals();if(tab==="Transaction"&&areaListOpen)await loadAreaInventory();pushAudit({action:"SUBMIT_TX",details:`Mode=RESTOCK Qty=${qty} Item=${item.name} From=MAIN SUPPLY To=${selectedAreaName}`});return;}}catch(e:any){alert(`Transaction failed: ${e?.message??"unknown error"}`);} finally{setSubmitting(false);}}  async function undoLast(){if(!lastTx||undoBusy||locked)return;if(!staffName.trim()){return alert("No staff name — please log out and log back in.");}const ok=confirm(`UNDO last transaction?\n\n${lastTx.mode} x${lastTx.qty}\n${lastTx.item_name??lastTx.item_id}\nArea: ${lastTx.area_name??lastTx.storage_area_id}\nMAIN override: ${lastTx.mainOverride?"YES":"NO"}`);if(!ok)return;setUndoBusy(true);try{if(lastTx.mode==="USE"){const{error}=await supabase.rpc("add_stock",{p_item_id:lastTx.item_id,p_area_id:lastTx.storage_area_id,p_qty:lastTx.qty});if(error)throw error;const newOnHand=await fetchOnHand(lastTx.storage_area_id,lastTx.item_id);setStatus(`↩️ UNDONE. On-hand now ${newOnHand}`);pushAudit({action:"UNDO_TX",details:`Reversed=USE Qty=${lastTx.qty} Item=${lastTx.item_name??lastTx.item_id} Area=${lastTx.area_name??lastTx.storage_area_id}`});setLastTx(null);if(tab==="Totals")await loadTotals();if(tab==="Transaction"&&areaListOpen)await loadAreaInventory();return;}if(lastTx.mode==="RESTOCK"){const{error}=await supabase.rpc("move_stock",{p_item_id:lastTx.item_id,p_from_area:lastTx.storage_area_id,p_to_area:MAIN_SUPPLY_ID,p_qty:lastTx.qty});if(error)throw error;const newOnHand=await fetchOnHand(lastTx.storage_area_id,lastTx.item_id);setStatus(`↩️ UNDONE. On-hand now ${newOnHand}`);pushAudit({action:"UNDO_TX",details:`Reversed=RESTOCK Qty=${lastTx.qty} Item=${lastTx.item_name??lastTx.item_id} Area=${lastTx.area_name??lastTx.storage_area_id} (moved back to MAIN)`});setLastTx(null);if(tab==="Totals")await loadTotals();if(tab==="Transaction"&&areaListOpen)await loadAreaInventory();return;}}catch(e:any){alert(`Undo failed: ${e?.message??"unknown error"}`);}finally{setUndoBusy(false);}}
  function savePin(newPin:string){const cleaned=newPin.replace(/\D/g,"").slice(0,6);if(cleaned.length<4)return alert("PIN must be at least 4 digits.");localStorage.setItem(LS.PIN,cleaned);alert("PIN saved ✅");}
  function onToggleOverride(){setMainOverride((v)=>{const next=!v;pushAudit({action:next?"MAIN_OVERRIDE_ON":"MAIN_OVERRIDE_OFF",details:`Area=${selectedAreaName}`});return next;});}

  async function loadOrderRowsForItem(itemId:string,mode2:"modal"|"totals"="modal"){if(mode2==="modal"){setOrderStatusLoading(true);setOrderStatusRows([]);}else{setTotalsOrderLoading(true);setTotalsOrderRows([]);}try{const{data,error}=await supabase.from("purchase_order_items").select("id,qty_ordered,qty_received,status,notes,purchase_orders(id,po_number,vendor,status,expected_date,order_date,notes)").eq("item_id",itemId).order("created_at",{ascending:false});if(error)throw error;if(mode2==="modal")setOrderStatusRows((data as OrderStatusRow[])??[]);else setTotalsOrderRows((data as OrderStatusRow[])??[]);}catch(e:any){if(mode2==="modal"){alert(`Order status failed: ${e?.message??"unknown error"}`);setOrderStatusOpen(false);}else setTotalsOrderRows([]);}finally{if(mode2==="modal")setOrderStatusLoading(false);else setTotalsOrderLoading(false);}}
  async function openOrderStatus(){if(!item?.id)return;setOrderStatusOpen(true);await loadOrderRowsForItem(item.id,"modal");}
  async function openTotalsEditor(row:BuildingTotalRow){setTotalsEditRow(row);setSetOnHandInput(String(row.total_on_hand??0));setDeltaInput("");setParInput(String(row.par_level??0));setVendorInput(row.vendor??"");setCategoryInput(row.category??"");setUnitInput(row.unit??"");setNotesInput(row.notes??"");setTotalsLowInput(String(row.low_level??0));setRefInput(row.reference_number??"");setTotalsOrderStatusInput(row.order_status||"IN STOCK");setTotalsBackorderedInput(!!row.backordered);setSupplySourceInput(row.supply_source||"VENDOR");setPriceInput(row.price!=null?String(row.price):"");setExpirationInput(row.expiration_date||"");setTotalsEditOpen(true);loadOrderRowsForItem(row.item_id,"totals").catch(()=>{});}
  function parseIntSafe(raw:string):number|null{const cleaned=raw.trim();if(!cleaned||!/^-?\d+$/.test(cleaned))return null;const n=Number(cleaned);return Number.isFinite(n)?n:null;}

  async function doTotalsSet(row:BuildingTotalRow,value:number,pinAlreadyPassed=false){if(locked&&!pinAlreadyPassed){setPendingTotalsAction({kind:"SET",value});openPin("totalsEdit");return;}const res=await fetch("/api/building-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({item_id:row.item_id,action:"SET",value})});const json=await res.json();if(!json.ok){alert(`Update failed: ${json.error}`);return;}pushAudit({action:"TOTALS_SET",details:`Item=${row.name} Set=${value}`});setTotalsEditOpen(false);await loadTotals();}
  async function doTotalsAdjust(row:BuildingTotalRow,delta:number,pinAlreadyPassed=false){if(delta===0){alert("Delta cannot be 0.");return;}if(locked&&!pinAlreadyPassed){setPendingTotalsAction({kind:"ADJUST",delta});openPin("totalsEdit");return;}const res=await fetch("/api/building-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({item_id:row.item_id,action:"ADJUST",delta})});const json=await res.json();if(!json.ok){alert(`Update failed: ${json.error}`);return;}pushAudit({action:"TOTALS_ADJUST",details:`Item=${row.name} Delta=${delta>0?"+":""}${delta}`});setTotalsEditOpen(false);await loadTotals();}
  async function doTotalsSetActive(row:BuildingTotalRow,is_active:boolean,pinAlreadyPassed=false){if(locked&&!pinAlreadyPassed){setPendingTotalsAction({kind:"SET_ACTIVE",is_active});openPin("totalsEdit");return;}if(!confirm(is_active?`Restore "${row.name}" to active items?`:`Move "${row.name}" to inactive items?`))return;const res=await fetch("/api/building-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({item_id:row.item_id,action:"SET_ACTIVE",is_active})});const json=await res.json();if(!json.ok){alert(`Update failed: ${json.error}`);return;}pushAudit({action:is_active?"ITEM_RESTORED":"ITEM_INACTIVE",details:`Item=${row.name}`});setTotalsEditOpen(false);await loadTotals();}

  async function doSaveItemStatus(itemId:string,order_status:string,backordered:boolean,itemName?:string){setItemStatusSaving(true);try{const cleanStatus=(order_status||"IN STOCK").trim().toUpperCase();const{error}=await supabase.from("items").update({order_status:cleanStatus,backordered:!!backordered}).eq("id",itemId);if(error)throw error;if(item&&item.id===itemId)setItem({...item,order_status:cleanStatus,backordered:!!backordered});setMatches((prev)=>prev.map((m)=>m.id===itemId?{...m,order_status:cleanStatus,backordered:!!backordered}:m));setTotals((prev)=>prev.map((r)=>r.item_id===itemId?{...r,order_status:cleanStatus,backordered:!!backordered}:r));setAreaInv((prev)=>prev.map((r)=>r.item_id===itemId?{...r,order_status:cleanStatus,backordered:!!backordered}:r));if(totalsEditRow?.item_id===itemId){setTotalsEditRow({...totalsEditRow,order_status:cleanStatus,backordered:!!backordered});setTotalsOrderStatusInput(cleanStatus);setTotalsBackorderedInput(!!backordered);}if(areaEditRow?.item_id===itemId)setAreaEditRow({...areaEditRow,order_status:cleanStatus,backordered:!!backordered});setStatus(`Saved item status for ${itemName||item?.name||"item"}`);pushAudit({action:"ITEM_STATUS_SAVE",details:`Item=${itemName||item?.name||itemId} Status=${cleanStatus} Backordered=${backordered?"YES":"NO"}`});}catch(e:any){alert(`Status save failed: ${e?.message??"unknown error"}`);}finally{setItemStatusSaving(false);}}
  async function saveItemStatus(itemId:string,order_status:string,backordered:boolean,itemName?:string){if(locked){setPendingItemStatusSave({item_id:itemId,order_status,backordered,item_name:itemName});openPin("itemStatusEdit");return;}await doSaveItemStatus(itemId,order_status,backordered,itemName);}

  function openAreaRowEditor(row:AreaInvRow){setAreaEditRow(row);setAreaEditOnHand(String(row.on_hand??0));setAreaEditPar(String(row.par_level??0));setAreaEditLow(String(row.low_level??0));setAreaEditOpen(true);pushAudit({action:"AREA_ROW_EDIT_OPEN",details:`Area=${row.storage_area_name} Item=${row.item_name}`});}
  function buildAreaSavePayload(row:AreaInvRow){const onHand=parseIntSafe(areaEditOnHand);const par=parseIntSafe(areaEditPar);const low=parseIntSafe(areaEditLow);if(onHand===null||onHand<0)throw new Error("On-hand must be 0 or more.");if(par===null||par<0)throw new Error("Par must be 0 or more.");if(low===null||low<0)throw new Error("Low must be 0 or more.");return{storage_area_id:row.storage_area_id,item_id:row.item_id,on_hand:onHand,par_level:par,low_level:low};}
  async function saveAreaRow(payload:{storage_area_id:string;item_id:string;on_hand:number|null;par_level:number|null;low_level:number|null},pinAlreadyPassed=false){if(locked&&!pinAlreadyPassed){setPendingAreaRowSave(payload);openPin("areaRowEdit");return;}const res=await fetch("/api/storage-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify(payload)});const json=await res.json();if(!json.ok){alert(`Save failed: ${json.error}`);return;}pushAudit({action:"AREA_ROW_EDIT_SAVE",details:`Area=${selectedAreaName} ItemID=${payload.item_id} on_hand=${payload.on_hand} par=${payload.par_level} low=${payload.low_level}`});setAreaEditOpen(false);await loadAreaInventory();}

  const staffMissing=!staffName.trim();
  const sc=statusClass(status);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:PREMIUM_CSS}} />
      <div className="p-root">
        <div className="p-wrap">
          <button onClick={()=>router.push("/")} className="back-btn">← Back</button>
          <div className="hdr-card">
            <div className="fxb">
              <div style={{minWidth:0}}>
                <div className="fx" style={{gap:10,marginBottom:4}}>
                  <div className="hdr-logo">⚕️</div>
                  <div className="hdr-title">Baxter <span>ASC</span></div>
                </div>
                <div className="hdr-sub">Cabinet tracking + building totals + low stock alerts</div>
              </div>
              <div style={{flexShrink:0,minWidth:0}}>
                <div className="loc-badge">
                  <div className="loc-lbl">Location</div>
                  <div className="loc-name">{selectedAreaName}</div>
                </div>
                <button onClick={()=>openPin(locked?"unlock":"lock")} className={`lock-btn ${locked?"locked":"unlocked"}`}>
                  <span>{locked?"🔒":"🔓"}</span><span>{locked?"Locked":"Unlocked"}</span>
                </button>
              </div>
            </div>
            <div className="tab-bar">
              <TabBtn active={tab==="Transaction"} onClick={()=>setTab("Transaction")}>Tx</TabBtn>
              <TabBtn active={tab==="Totals"} onClick={()=>setTab("Totals")}>Totals</TabBtn>
              <TabBtn active={tab==="Audit"} onClick={()=>setTab("Audit")}>Audit</TabBtn>
              <TabBtn active={tab==="Settings"} onClick={()=>setTab("Settings")}>Settings</TabBtn>
            </div>
          </div>

          {tab==="Transaction" && (
            <div className="c-card anim">
              <div className="s-lbl">Select Location</div>
              {locked?(
                <div className="c-deep" style={{marginBottom:6}}>
                  <div style={{fontSize:10,color:"var(--text3)"}}>Locked to:</div>
                  <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginTop:3,wordBreak:"break-word"}}>{selectedAreaName}</div>
                  <div style={{fontSize:11,color:"var(--text4)",marginTop:4}}>Unlock to change location.</div>
                </div>
              ):(
                <select value={areaId} onChange={(e)=>requestLocationChange(e.target.value)} className="inp inp-sel" style={{marginBottom:6}}>
                  {areasLoading?<option value="">Loading locations…</option>:areas.length===0?<option value="">No locations found</option>:areas.map((a)=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {locked && <div style={{fontSize:11,color:"var(--text4)",marginBottom:12}}>Locked: password required once per app session.</div>}
              <div className="tog-wrap-2 mt3">
                <button onClick={()=>{setAreaListOpen(false);pushAudit({action:"AREA_LIST_TOGGLE",details:"SCAN"});}} className={`tog ${!areaListOpen?"on":"off"}`}>SCAN MODE</button>
                <button onClick={()=>{setAreaListOpen(true);pushAudit({action:"AREA_LIST_TOGGLE",details:`AREA_LIST Area=${selectedAreaName}`});}} className={`tog ${areaListOpen?"on":"off"}`}>AREA LIST</button>
              </div>

              {areaListOpen?(
                <div className="c-inner mt3">
                  <div className="area-hdr">
                    <div className="area-title">{selectedAreaName}</div>
                    <div className="area-count">{areaInvLoading?"Loading…":`${filteredAreaInv.length} / ${areaInv.length}`}</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--text4)",marginBottom:10,lineHeight:1.5}}>Tip: If you see "0 shown" but total is not 0, a filter is hiding rows.</div>
                  <div className="tog-wrap-3">
                    <button onClick={()=>setAreaParOnly((v)=>!v)} className={`tog ${areaParOnly?"on":"off"}`}>PAR: {areaParOnly?"ONLY":"ALL"}</button>
                    <button onClick={()=>setAreaLowOnly((v)=>!v)} className={`tog ${areaLowOnly?"on-red":"off"}`}>LOW: {areaLowOnly?"ONLY":"ALL"}</button>
                    <button onClick={()=>loadAreaInventory()} className="tog off">Refresh</button>
                  </div>
                  <input value={areaInvSearch} onChange={(e)=>setAreaInvSearch(e.target.value)} placeholder="Search item, vendor, category, status…" className="inp mt3" />
                  {areaInvError && <div style={{color:"#fca5a5",fontSize:12,marginTop:8,wordBreak:"break-word"}}>{areaInvError}</div>}
                  <div className="sp mt3">
                    {filteredAreaInv.slice(0,200).map((r)=>{
                      const oh=r.on_hand??0;const par=r.par_level??0;const low=r.low_level??0;const isLow=low>0&&oh<=low;
                      return (
                        <button key={`${r.storage_area_id}-${r.item_id}`} onClick={()=>openAreaRowEditor(r)} className={`item-card ${isLow?"low":"ok"}`}>
                          <div className="fxb">
                            <div style={{minWidth:0,flex:1}}>
                              <div className="i-name">{r.item_name}</div>
                              <div className="i-meta">{r.vendor??"—"} · {r.category??"—"}{r.reference_number?` · ${r.reference_number}`:""}</div>
                              <div className="i-status">Status: {r.order_status||"IN STOCK"}{r.backordered?" · BACKORDERED":""}</div>
                            </div>
                            <div className={`oh-badge ${isLow?"low":"ok"}`}>
                              <div className={`oh-num ${isLow?"low":"ok"}`}>{oh}</div>
                              <div className="oh-unit">on hand</div>
                            </div>
                          </div>
                          <div className="stats-row">
                            {[["Par",par],["Low",low],["Unit",r.unit??"—"]].map(([l,v])=>(<div key={String(l)} className="stat-pill"><div className="stat-lbl">{l}</div><div className="stat-val">{v}</div></div>))}
                          </div>
                          {r.notes && <div className="notes-txt">Notes: {r.notes}</div>}
                          <div className="edit-hint">Tap to edit (password required once per app session).</div>
                        </button>
                      );
                    })}
                    {filteredAreaInv.length===0&&!areaInvLoading&&<div style={{textAlign:"center",padding:"28px 0",color:"var(--text4)",fontSize:13}}>No items found</div>}
                  </div>
                  <div style={{marginTop:14,fontSize:10,color:"var(--text4)"}}>Showing up to 200 rows to keep it fast on phones.</div>
                  {areaEditOpen && areaEditRow && (
                    <AscModal title="Edit area item" okText="Save" onCancel={()=>setAreaEditOpen(false)} onOk={async()=>{try{const payload=buildAreaSavePayload(areaEditRow);await saveAreaRow(payload);}catch(e:any){alert(e?.message??"Invalid values");}}}>
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:15,fontWeight:800,color:"var(--text)",wordBreak:"break-word"}}>{areaEditRow.item_name}</div>
                        <div style={{fontSize:12,color:"var(--text2)",marginTop:3}}>{areaEditRow.storage_area_name}{areaEditRow.reference_number?` · ${areaEditRow.reference_number}`:""}</div>
                      </div>
                      <div className="c-panel mb3">
                        <div className="s-title">Item status</div>
                        <div className="field"><label className="f-lbl">Order status</label><select value={areaEditRow.order_status||"IN STOCK"} onChange={(e)=>setAreaEditRow({...areaEditRow,order_status:e.target.value})} className="inp inp-sel">{ITEM_STATUS_OPTIONS.map((opt)=><option key={opt} value={opt}>{opt}</option>)}</select></div>
                        <label className="chk-row"><input type="checkbox" checked={!!areaEditRow.backordered} onChange={(e)=>setAreaEditRow({...areaEditRow,backordered:e.target.checked})} /><span>Backordered</span></label>
                        <button onClick={async()=>{await saveItemStatus(areaEditRow.item_id,areaEditRow.order_status||"IN STOCK",!!areaEditRow.backordered,areaEditRow.item_name);await loadAreaInventory();}} disabled={itemStatusSaving} className="btn btn-ac btn-full mt3" style={{fontSize:13}}>{itemStatusSaving?"Saving…":"Save Item Status"}</button>
                      </div>
                      <div className="g3">
                        <div className="field"><label className="f-lbl">On hand</label><input value={areaEditOnHand} onChange={(e)=>setAreaEditOnHand(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" style={{textAlign:"center"}} /></div>
                        <div className="field"><label className="f-lbl">PAR</label><input value={areaEditPar} onChange={(e)=>setAreaEditPar(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" style={{textAlign:"center"}} /></div>
                        <div className="field"><label className="f-lbl">LOW</label><input value={areaEditLow} onChange={(e)=>setAreaEditLow(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" style={{textAlign:"center"}} /></div>
                      </div>
                      <div style={{fontSize:10,color:"var(--text4)",marginTop:8}}>Saves counts to <strong style={{color:"var(--text2)"}}>storage_inventory</strong> and status to <strong style={{color:"var(--text2)"}}>items</strong>.</div>
                    </AscModal>
                  )}
                </div>
              ):(
                <>
                  <div className="c-sm mt3">
                    <div className="fxb">
                      <div style={{minWidth:0}}>
                        <div className="s-title">One-time override</div>
                        <div className="s-desc">Grabbed it from MAIN supply room? Tap once.</div>
                      </div>
                      <button onClick={onToggleOverride} className={`ov-btn ${mainOverride?"on":""}`}>
                        <div className="ov-icon">⚡</div>
                        <div className={`ov-lbl ${mainOverride?"on":"off"}`}>MAIN (1x)</div>
                      </button>
                    </div>
                  </div>
                  {mainOverride && (
                    <div className="alert-warn mt2">
                      <div className="t">⚡ MAIN OVERRIDE ACTIVE (1 transaction)</div>
                      <div className="b">This submit will be treated as pulled from MAIN supply room.</div>
                      <button onClick={()=>setMainOverride(false)} className="btn btn-gh btn-full" style={{marginTop:10,fontSize:12}}>Cancel MAIN Override</button>
                    </div>
                  )}
                  <div className="c-sm mt3">
                    <div className="s-title">Mode</div>
                    <div className="s-desc">{mode==="USE"?"Use removes items from on-hand.":"Restock adds items to on-hand."}</div>
                    <div className="mode-row">
                      <ModeBtn active={mode==="USE"} danger onClick={()=>setMode("USE")}>USE</ModeBtn>
                      <ModeBtn active={mode==="RESTOCK"} onClick={()=>setMode("RESTOCK")}>RESTOCK</ModeBtn>
                    </div>
                  </div>
                  <div className="lk-row">
                    {(["BARCODE","REF","NAME"] as LookupMode[]).map((m)=>(<button key={m} onClick={()=>{setLookupMode(m);setMatches([]);}} className={`lk-tab ${lookupMode===m?"on":"off"}`}>{m==="REF"?"REF #":m}</button>))}
                  </div>
                  <div className="srch-row">
                    <div className="srch-wrap">
                      <input value={query} onChange={(e)=>{setQuery(e.target.value);setStatus("");}} onKeyDown={async(e)=>{if(e.key==="Enter")await lookup(query);}} placeholder={lookupMode==="BARCODE"?"Scan or type barcode":lookupMode==="REF"?"Type reference number":"Type item name"} className="srch-inp" />
                      <button onClick={()=>startScanner()} className="cam-btn" aria-label="Start scanner">📷</button>
                    </div>
                    <button onClick={async()=>await lookup(query)} className="btn btn-ac">Find</button>
                  </div>
                  {lookupMode!=="BARCODE" && (<div style={{fontSize:11,color:"var(--text4)",marginTop:7,lineHeight:1.5}}>{suggestLoading?"Searching…":matches.length?"Suggestions:":query.trim().length>=2?"No suggestions yet (press Find to search fully).":"Type 2+ characters for suggestions."}</div>)}
                  {matches.length>0 && (
                    <div className="sp mt2">
                      {matches.slice(0,8).map((m)=>(<button key={m.id} onClick={()=>{setItem(m);setItemStatusDraft({order_status:m.order_status||"IN STOCK",backordered:!!m.backordered});setOrderStatusRows([]);setMatches([]);setStatus(`Selected: ${m.name}`);}} className="sug-item"><div className="sug-name">{m.name}</div><div className="sug-meta">{m.reference_number?`Ref: ${m.reference_number}`:"Ref: —"} · {m.barcode?`Barcode: ${m.barcode}`:"Barcode: —"}</div><div className="sug-status">Status: {m.order_status||"IN STOCK"} {m.backordered?"· BACKORDERED":""}</div></button>))}
                    </div>
                  )}
                  {status && <div className={`s-bar ${sc}`}><span>{status}</span></div>}
                  {item && (
                    <div className="found-panel">
                      <div className="fxb" style={{marginBottom:10}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div className="f-name">{item.name}</div>
                          <div className="f-meta">{item.reference_number?`Ref: ${item.reference_number}`:""}{item.reference_number&&item.barcode?" · ":""}{item.barcode?`Barcode: ${item.barcode}`:""}</div>
                        </div>
                        <button onClick={()=>{setItem(null);setQuery("");setStatus("");setMatches([]);setOrderStatusRows([]);}} style={{flexShrink:0,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--r-md)",padding:"8px 14px",color:"#fca5a5",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginLeft:10}}>✕ Cancel</button>
                      </div>
                      <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:"var(--r-lg)",padding:"14px",marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:800,color:"var(--ac-bright)",marginBottom:10,letterSpacing:"0.3px"}}>{mode==="USE"?"USE — removes from on-hand":"RESTOCK — adds to on-hand"}</div>
                        <div className="qty-row" style={{marginTop:0}}>
                          <QtyBtn onClick={()=>setQty((q)=>Math.max(1,q-1))}>−</QtyBtn>
                          <div className="qty-disp">{qty}</div>
                          <QtyBtn onClick={()=>setQty((q)=>q+1)}>+</QtyBtn>
                        </div>
                        <button className="btn btn-submit btn-full btn-lg" style={{marginTop:12}} disabled={submitting} onClick={submit}>{submitting?"Submitting…":mode==="USE"?`USE ${qty} — Submit`:`RESTOCK ${qty} — Submit`}</button>
                        {locked && <div style={{marginTop:8,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,color:"#fca5a5",textAlign:"center"}}>🔒 App is locked — tap the lock button above to unlock</div>}
                      </div>
                      <details style={{marginBottom:8}}>
                        <summary style={{fontSize:12,color:"var(--text3)",cursor:"pointer",padding:"6px 0",listStyle:"none",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10}}>▸</span> Item Status &amp; Order History</summary>
                        <div style={{marginTop:10}}>
                          <div className="c-panel">
                            <div className="s-title">Item status</div>
                            <div className="field"><label className="f-lbl">Order status</label><select value={itemStatusDraft.order_status} onChange={(e)=>setItemStatusDraft((prev)=>({...prev,order_status:e.target.value}))} className="inp inp-sel">{ITEM_STATUS_OPTIONS.map((opt)=><option key={opt} value={opt}>{opt}</option>)}</select></div>
                            <label className="chk-row"><input type="checkbox" checked={itemStatusDraft.backordered} onChange={(e)=>setItemStatusDraft((prev)=>({...prev,backordered:e.target.checked}))}/><span>Backordered</span></label>
                            <button onClick={async()=>{await saveItemStatus(item.id,itemStatusDraft.order_status,itemStatusDraft.backordered,item.name);}} disabled={itemStatusSaving||staffMissing} className="btn btn-ac btn-full mt3" style={{fontSize:13}}>{itemStatusSaving?"Saving…":"Save Item Status"}</button>
                          </div>
                          <button onClick={openOrderStatus} className="btn btn-gh btn-full" style={{marginTop:10,fontSize:13}}>View Order History</button>
                        </div>
                      </details>
                    </div>
                  )}
                  {!item && (<><div className="qty-row"><QtyBtn onClick={()=>setQty((q)=>Math.max(1,q-1))}>−</QtyBtn><div className="qty-disp">{qty}</div><QtyBtn onClick={()=>setQty((q)=>q+1)}>+</QtyBtn></div><button className="btn btn-submit btn-full btn-lg mt3" disabled={!item||locked||staffMissing} onClick={submit}>Submit</button></>)}
                  <button className="btn btn-gh btn-full" style={{marginTop:10,fontSize:13}} disabled={!lastTx||locked||staffMissing||undoBusy} onClick={undoLast}>{undoBusy?"Undoing…":"↩️ Undo last transaction"}</button>
                </>
              )}

              {pinOpen && (
                <AscModal title={pinPurpose==="unlock"?"Enter password to unlock edits":pinPurpose==="lock"?"Enter password to lock":pinPurpose==="changeLocation"?"Enter password to change location":pinPurpose==="addItem"?"Enter password to add item":pinPurpose==="areaRowEdit"?"Enter password to edit this area item":pinPurpose==="itemStatusEdit"?"Enter password to save item status":"Enter password to edit totals"} okText="OK" onCancel={()=>{setPinOpen(false);setPendingArea("");setPendingTotalsAction(null);setPendingAreaRowSave(null);setPendingItemStatusSave(null);}} onOk={onPinConfirm}>
                  <input value={pinInput} onChange={(e)=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" type="password" className="pin-inp" placeholder="Password" />
                  <div className="pin-hint">Unlock lasts until you fully close this app/tab. Default password is <strong style={{color:"var(--text2)"}}>1234</strong> until changed in Settings.</div>
                </AscModal>
              )}
              {addOpen && (
                <AscModal title="Add New Item" okText="Add Item" onCancel={()=>setAddOpen(false)} onOk={()=>addItemNow()}>
                  <div style={{fontSize:13,color:"var(--text2)",marginBottom:14,lineHeight:1.5}}>Item not found for: <strong style={{color:"var(--text)"}}>{query}</strong></div>
                  <div className="field"><label className="f-lbl">Item Name *</label><input value={addName} onChange={(e)=>setAddName(e.target.value)} className="inp" placeholder="e.g., Surgical Gloves Large" /></div>
                  <div className="field"><label className="f-lbl">PAR Level</label><input type="number" value={addPar} onChange={(e)=>setAddPar(Number(e.target.value))} className="inp" min={0} /></div>
                </AscModal>
              )}
              {scannerOpen && (
                <div className="scan-ov">
                  <div className="scan-hdr"><div className="scan-title">Scan Barcode</div><button onClick={closeScanner} className="scan-close">Close</button></div>
                  <div className="scan-vp"><video ref={videoRef} className="scan-vid" muted playsInline /><div className="scan-frame"><div className="scan-box" /></div></div>
                  <div className="scan-hint">Hold the barcode steady inside the box. Best distance: 6–10 inches.</div>
                </div>
              )}
              {orderStatusOpen && (
                <AscModal title="Order Status" okText="Close" onCancel={()=>setOrderStatusOpen(false)} onOk={()=>setOrderStatusOpen(false)}>
                  {item && <div className="c-deep mb3"><div style={{fontSize:12,fontWeight:800,color:"var(--text)",marginBottom:4}}>Current item status</div><div style={{fontSize:12,color:"var(--text2)"}}>{item.order_status||"IN STOCK"} {item.backordered?"· BACKORDERED":""}</div></div>}
                  {orderStatusLoading?<div style={{fontSize:13,color:"var(--text2)",padding:"12px 0"}}>Loading…</div>:orderStatusRows.length===0?<div style={{fontSize:13,color:"var(--text2)",padding:"12px 0"}}>No order history found for this item.</div>:<OrderStatusList rows={orderStatusRows} />}
                </AscModal>
              )}
            </div>
          )}

          {tab==="Totals" && (
            <div className="c-card anim">
              <div className="tot-hdr">
                <div className="tot-title">{totalsShowInactive?"Inactive Items":"Building Totals"}</div>
                <div className="tot-count">{totalsLoading?"Loading…":`${filteredTotals.length} shown`}</div>
              </div>
              <input value={totalsSearch} onChange={(e)=>setTotalsSearch(e.target.value)} placeholder="Search name, vendor, category, status…" className="inp mb3" />
              <div className="tog-wrap-2">
                <button onClick={()=>setTotalsShowInactive(false)} className={`tog ${!totalsShowInactive?"on":"off"}`}>ACTIVE</button>
                <button onClick={()=>setTotalsShowInactive(true)} className={`tog ${totalsShowInactive?"on-yel":"off"}`}>INACTIVE</button>
              </div>
              <div className="tog-wrap-2 mt2">
                <button onClick={()=>setTotalsLowOnly((v)=>!v)} className={`tog ${totalsLowOnly?"on-red":"off"}`}>{totalsLowOnly?"LOW ONLY":"LOW FILTER"}</button>
                <button onClick={()=>setTotalsZeroOnly((v)=>!v)} className={`tog ${totalsZeroOnly?"on-yel":"off"}`}>{totalsZeroOnly?"ZERO ONLY":"ZERO SETUP"}</button>
              </div>
              <div className="tog-wrap-2 mt2 mb3">
                <button onClick={loadTotals} className="btn btn-gh" style={{fontSize:13}}>Refresh</button>
                <button onClick={()=>{setTotalsLowOnly(false);setTotalsZeroOnly(false);setTotalsSearch("");}} className="btn btn-gh" style={{fontSize:13}}>Clear</button>
              </div>
              <button onClick={()=>{setOrderPinInput("");setOrderPinError(false);setOrderPinOpen(true);}} className="btn btn-ac btn-full mb3" style={{fontSize:13}}>📦 Request Order</button>
              {totalsError && <div style={{color:"#fca5a5",fontSize:12,marginBottom:10,wordBreak:"break-word"}}>{totalsError}</div>}
              <div className="sp">
                {filteredTotals.map((r)=>{
                  const oh=r.total_on_hand??0;const low=r.low_level??0;const par=r.par_level??0;
                  const zeroSetup=par===0||low===0;const isLow=low>0&&oh<=low;
                  const src=supplySourceLabel(r.supply_source);
                  const expDiff=r.expiration_date?Math.ceil((new Date(r.expiration_date).getTime()-Date.now())/(1000*60*60*24)):null;
                  return (
                    <button key={`${r.item_id}-${r.reference_number??""}`} onClick={()=>openTotalsEditor(r)} className={`item-card ${isLow?"low":zeroSetup?"warn":"ok"}`}>
                      <div className="fxb">
                        <div style={{minWidth:0,flex:1}}>
                          <div className="i-name">{r.name}</div>
                          <div className="i-meta">{r.vendor??"—"} · {r.category??"—"}{r.reference_number?` · ${r.reference_number}`:""}</div>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                            <span className="i-status">Status: {r.order_status||"IN STOCK"}{r.backordered?" · BACKORDERED":""}</span>
                            <span className={src.cls}>{src.label}</span>
                            {expDiff!==null&&expDiff<0&&<span style={{fontSize:9,fontWeight:800,color:"#fca5a5",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,padding:"1px 6px"}}>EXPIRED</span>}
                            {expDiff!==null&&expDiff>=0&&expDiff<=30&&<span style={{fontSize:9,fontWeight:800,color:"#fcd34d",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:4,padding:"1px 6px"}}>EXP {expDiff}d</span>}
                          </div>
                        </div>
                        <div className={`oh-badge ${isLow?"low":"ok"}`}>
                          <div className={`oh-num ${isLow?"low":"ok"}`}>{oh}</div>
                          <div className="oh-unit">on hand</div>
                        </div>
                      </div>
                      <div className="stats-row">
                        {[{label:"Par",value:par,warn:par===0},{label:"Low",value:low,warn:low===0},{label:"Unit",value:r.unit??"—",warn:false}].map(({label,value,warn})=>(<div key={label} className={`stat-pill ${warn?"wb":""}`}><div className="stat-lbl">{label}</div><div className={`stat-val ${warn?"w":""}`}>{value}</div></div>))}
                      </div>
                      {zeroSetup && <div className="zero-warn">⚠ Zero setup field detected</div>}
                      {r.notes && <div className="notes-txt">Notes: {r.notes}</div>}
                      <div className="edit-hint">Tap to edit on-hand + item details{locked?" (password required once per app session)":""}</div>
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {tab==="Audit" && (
            <div className="c-card anim">
              <div style={{marginBottom:18}}>
                <div style={{fontSize:18,fontWeight:900,color:"var(--text)",letterSpacing:"-0.5px",marginBottom:4}}>Audit Log</div>
                <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>All actions logged under your name.</div>
              </div>
              <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#6ee7b7",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                <span>🟢 Online as: <strong>{staffName||"Not set"}</strong></span>
                <button onClick={()=>{setNameInput(staffName);setNamePromptOpen(true);}} style={{background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,color:"#93c5fd",padding:"4px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>Change Name</button>
              </div>
              <div className="g2 mt3">
                <button onClick={()=>{setAudit([]);try{localStorage.removeItem(LS.AUDIT);}catch{}}} className="btn btn-gh" style={{fontSize:13}}>Clear device log</button>
                <button onClick={()=>{const text=JSON.stringify(audit,null,2);navigator.clipboard?.writeText(text).then(()=>alert("Audit log copied ✅")).catch(()=>alert("Copy failed."));}} className="btn btn-ac" style={{fontSize:13}}>Copy log</button>
              </div>
              <div className="divider" />
              <div className="s-lbl">Recent Events</div>
              <div className="sp">
                {audit.length===0?(<div className="c-deep" style={{textAlign:"center",color:"var(--text3)",fontSize:13,padding:"20px 0"}}>No audit events yet.</div>):(audit.slice(0,60).map((e)=>(<div key={e.id} className="audit-card"><div className="audit-hdr"><span className="audit-act" style={auditStyle(e.action)}>{e.action}</span><span className="audit-time">{new Date(e.ts).toLocaleString()}</span></div><div className="audit-stf">Staff: <strong>{e.staff}</strong></div>{e.details&&<div className="audit-det">{e.details}</div>}</div>)))}
              </div>
            </div>
          )}

          {tab==="Settings" && (
            <div className="c-card anim">
              <div style={{marginBottom:18}}>
                <div style={{fontSize:18,fontWeight:900,color:"var(--text)",letterSpacing:"-0.5px",marginBottom:4}}>Settings</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>Set/Change password (min 4 digits):</div>
              </div>
              <PinSetter onSave={savePin} />
            </div>
          )}
        </div>
      </div>

      {totalsEditOpen && totalsEditRow && (
        <AscModal title="Edit building totals" okText="Close" onCancel={()=>setTotalsEditOpen(false)} onOk={()=>setTotalsEditOpen(false)}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:800,color:"var(--text)",wordBreak:"break-word",letterSpacing:"-0.3px"}}>{totalsEditRow.name}</div>
            <div style={{fontSize:12,color:"var(--text2)",marginTop:3}}>{totalsEditRow.vendor??"—"} · {totalsEditRow.category??"—"}{totalsEditRow.reference_number?` · ${totalsEditRow.reference_number}`:""}</div>
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Item status</div>
            <div className="field"><label className="f-lbl">Order status</label><select value={totalsOrderStatusInput} onChange={(e)=>setTotalsOrderStatusInput(e.target.value)} className="inp inp-sel">{ITEM_STATUS_OPTIONS.map((opt)=><option key={opt} value={opt}>{opt}</option>)}</select></div>
            <label className="chk-row"><input type="checkbox" checked={totalsBackorderedInput} onChange={(e)=>setTotalsBackorderedInput(e.target.checked)}/><span>Backordered</span></label>
            <button onClick={async()=>{await saveItemStatus(totalsEditRow.item_id,totalsOrderStatusInput,totalsBackorderedInput,totalsEditRow.name);await loadTotals();}} disabled={itemStatusSaving} className="btn btn-ac btn-full mt3" style={{fontSize:13}}>{itemStatusSaving?"Saving…":"Save Item Status"}</button>
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Order history</div>
            <div style={{fontSize:10,color:"var(--text4)",marginBottom:10}}>Read-only history from purchase orders.</div>
            {totalsOrderLoading?<div style={{fontSize:13,color:"var(--text2)"}}>Loading order status…</div>:totalsOrderRows.length===0?<div className="c-deep" style={{fontSize:13,color:"var(--text2)"}}>No order history found for this item.</div>:<OrderStatusList rows={totalsOrderRows} />}
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Item active state</div>
            <div className="g2 mt2">
              <button onClick={async()=>{await doTotalsSetActive(totalsEditRow,false);}} className="btn btn-warn" style={{fontSize:12}}>Move To Inactive</button>
              <button onClick={async()=>{await doTotalsSetActive(totalsEditRow,true);}} className="btn btn-gh" style={{fontSize:12}}>Restore Active</button>
            </div>
            <div style={{fontSize:10,color:"var(--text4)",marginTop:8}}>Password required once per app session. This does not delete the item.</div>
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Set PAR level</div>
            <div className="fx mt2">
              <input value={parInput} onChange={(e)=>setParInput(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" placeholder="e.g., 30" style={{flex:1}} />
              <button onClick={async()=>{const n=parseIntSafe(parInput);if(n===null||n<0)return alert("Enter a valid PAR (0 or more).");const res=await fetch("/api/building-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({item_id:totalsEditRow.item_id,action:"SET_PAR",par_level:n})});const json=await res.json();if(!json.ok)return alert(`PAR update failed: ${json.error}`);pushAudit({action:"TOTALS_ADJUST",details:`PAR Set Item=${totalsEditRow.name} Par=${n}`});setTotalsEditOpen(false);await loadTotals();}} className="btn btn-ac s0">Set PAR</button>
            </div>
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Item details</div>
            <div className="g2 mt2">
              <div className="field"><label className="f-lbl">Reference #</label><input value={refInput} onChange={(e)=>setRefInput(e.target.value)} className="inp" /></div>
              <div className="field"><label className="f-lbl">Low</label><input value={totalsLowInput} onChange={(e)=>setTotalsLowInput(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" /></div>
            </div>
            <div className="g2">
              <div className="field"><label className="f-lbl">Vendor</label><input value={vendorInput} onChange={(e)=>setVendorInput(e.target.value)} className="inp" /></div>
              <div className="field"><label className="f-lbl">Category</label><input value={categoryInput} onChange={(e)=>setCategoryInput(e.target.value)} className="inp" /></div>
            </div>
            <div className="field"><label className="f-lbl">Unit</label><input value={unitInput} onChange={(e)=>setUnitInput(e.target.value)} className="inp" /></div>
            <div className="field">
              <label className="f-lbl">Price per Unit ($)</label>
              <input value={priceInput} onChange={(e)=>setPriceInput(e.target.value.replace(/[^0-9.]/g,""))} className="inp" placeholder="e.g., 24.99" inputMode="decimal" />
            </div>
            <div className="field">
              <label className="f-lbl">Expiration Date</label>
              <input value={expirationInput} onChange={(e)=>setExpirationInput(e.target.value)} className="inp" type="date" />
              {expirationInput && (()=>{
                const exp=new Date(expirationInput);const now=new Date();const diff=Math.ceil((exp.getTime()-now.getTime())/(1000*60*60*24));
                if(diff<0)return <div style={{fontSize:11,color:"#fca5a5",marginTop:4,fontWeight:700}}>⚠️ EXPIRED {Math.abs(diff)} days ago</div>;
                if(diff<=30)return <div style={{fontSize:11,color:"#fcd34d",marginTop:4,fontWeight:700}}>⚠️ Expires in {diff} days</div>;
                return <div style={{fontSize:11,color:"#6ee7b7",marginTop:4}}>✅ Good for {diff} more days</div>;
              })()}
            </div>
            <div className="field">
              <label className="f-lbl">Supply Source</label>
              <select value={supplySourceInput} onChange={(e)=>setSupplySourceInput(e.target.value)} className="inp inp-sel">
                {SUPPLY_SOURCE_OPTIONS.map((opt)=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="field"><label className="f-lbl">Notes</label><textarea value={notesInput} onChange={(e)=>setNotesInput(e.target.value)} className="inp inp-ta" /></div>
            <button onClick={async()=>{const low=parseIntSafe(totalsLowInput);if(low===null||low<0)return alert("Enter a valid low level.");const res=await fetch("/api/building-inventory/update",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({item_id:totalsEditRow.item_id,action:"SAVE_ITEM_META",vendor:vendorInput,category:categoryInput,unit:unitInput,notes:notesInput,low_level:low,reference_number_new:refInput,supply_source:supplySourceInput,price:priceInput.trim()?Number(priceInput):null,expiration_date:expirationInput||null})});const json=await res.json();if(!json.ok)return alert(`Save failed: ${json.error}`);pushAudit({action:"TOTALS_ADJUST",details:`Meta Save Item=${totalsEditRow.name} Source=${supplySourceInput} Price=$${priceInput||"—"}`});setTotalsEditOpen(false);await loadTotals();}} className="btn btn-ac btn-full" style={{fontSize:13}}>Save Item Details</button>
          </div>
          <div className="c-panel mb3">
            <div className="s-title">Set exact on-hand</div>
            <div className="fx mt2">
              <input value={setOnHandInput} onChange={(e)=>setSetOnHandInput(e.target.value.replace(/[^\d]/g,""))} inputMode="numeric" className="inp" placeholder="e.g., 17" style={{flex:1}} />
              <button onClick={async()=>{const n=parseIntSafe(setOnHandInput);if(n===null||n<0)return alert("Enter a valid number (0 or more).");await doTotalsSet(totalsEditRow,n);}} className="btn btn-ac s0">Set</button>
            </div>
          </div>
          <div className="c-panel">
            <div className="s-title">Adjust + / −</div>
            <div className="g3 mt2">
              <button onClick={()=>setDeltaInput(String((parseIntSafe(deltaInput)??0)-1))} className="btn btn-gh" style={{fontSize:15,fontWeight:900}}>−1</button>
              <input value={deltaInput} onChange={(e)=>setDeltaInput(e.target.value.replace(/[^\d-]/g,"").slice(0,7))} inputMode="numeric" className="inp" placeholder="±" style={{textAlign:"center"}} />
              <button onClick={()=>setDeltaInput(String((parseIntSafe(deltaInput)??0)+1))} className="btn btn-gh" style={{fontSize:15,fontWeight:900}}>+1</button>
            </div>
            <div className="fx mt2">
              <button onClick={async()=>{const d=parseIntSafe(deltaInput);if(d===null)return alert("Enter a valid delta.");await doTotalsAdjust(totalsEditRow,d);}} className="btn btn-ac" style={{flex:1,fontSize:13}}>Apply delta</button>
              <button onClick={()=>setDeltaInput("")} className="btn btn-gh" style={{fontSize:13}}>Clear</button>
            </div>
          </div>
        </AscModal>
      )}

      {orderPinOpen && (
        <div className="modal-ov">
          <div className="modal anim" style={{maxWidth:340}}>
            <div className="modal-title">🔐 Enter Order PIN</div>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:14,lineHeight:1.5}}>Enter the 4-digit PIN to place an order request.</div>
            <input
              value={orderPinInput}
              onChange={e=>{setOrderPinInput(e.target.value.replace(/\D/g,"").slice(0,4));setOrderPinError(false);}}
              inputMode="numeric"
              type="password"
              className="pin-inp"
              placeholder="••••"
              autoFocus
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  if(orderPinInput===ORDER_PIN){setOrderPinOpen(false);setOrderReqItems({});setOrderReqDone(false);setOrderReqSearch("");setOrderReqLowOnly(false);setOrderReqOpen(true);}
                  else setOrderPinError(true);
                }
              }}
            />
            {orderPinError && <div style={{fontSize:12,color:"#fca5a5",marginTop:8,textAlign:"center"}}>❌ Wrong PIN. Try again.</div>}
            <div className="modal-footer">
              <button onClick={()=>setOrderPinOpen(false)} className="btn btn-gh" style={{flex:1}}>Cancel</button>
              <button onClick={()=>{
                if(orderPinInput===ORDER_PIN){setOrderPinOpen(false);setOrderReqItems({});setOrderReqDone(false);setOrderReqSearch("");setOrderReqLowOnly(false);setOrderReqOpen(true);}
                else setOrderPinError(true);
              }} className="btn btn-ac" style={{flex:1}}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {orderReqOpen && (
        <div className="modal-ov">
          <div className="modal anim" style={{maxHeight:"90vh",overflowY:"auto"}}>
            <div className="modal-title">📦 Request Order</div>
            {orderReqDone ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <div style={{fontSize:16,fontWeight:800,color:"var(--text)"}}>Order Request Sent!</div>
                <div style={{fontSize:13,color:"var(--text2)",marginTop:8}}>Email sent to both contacts.</div>
                <button onClick={()=>setOrderReqOpen(false)} className="btn btn-ac btn-full" style={{marginTop:20}}>Done</button>
              </div>
            ) : (
              <>
                {/* Toggle */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <button onClick={()=>setOrderReqLowOnly(false)} className={`tog ${!orderReqLowOnly?"on":"off"}`}>All Items</button>
                  <button onClick={()=>setOrderReqLowOnly(true)} className={`tog ${orderReqLowOnly?"on-red":"off"}`}>🔴 Low Only</button>
                </div>
                {/* Search */}
                <input
                  value={orderReqSearch}
                  onChange={(e)=>setOrderReqSearch(e.target.value)}
                  placeholder="Search name, vendor, ref #…"
                  className="inp"
                  style={{marginBottom:12}}
                />
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  {totals
                    .filter(r=>!!r.is_active)
                    .filter(r=>{
                      const isLow=(r.low_level??0)>0&&(r.total_on_hand??0)<=(r.low_level??0);
                      if(orderReqLowOnly&&!isLow)return false;
                      if(orderReqSearch.trim()){
                        const q=orderReqSearch.toLowerCase();
                        return (r.name||"").toLowerCase().includes(q)||(r.vendor||"").toLowerCase().includes(q)||(r.reference_number||"").toLowerCase().includes(q);
                      }
                      return true;
                    })
                    .sort((a,b)=>{
                      const aLow=(a.low_level??0)>0&&(a.total_on_hand??0)<=(a.low_level??0);
                      const bLow=(b.low_level??0)>0&&(b.total_on_hand??0)<=(b.low_level??0);
                      return aLow===bLow?0:aLow?-1:1;
                    })
                    .map((r)=>{
                    const checked = orderReqItems[r.item_id] !== undefined;
                    const qty = orderReqItems[r.item_id] ?? "";
                    const isLow=(r.low_level??0)>0&&(r.total_on_hand??0)<=(r.low_level??0);
                    return (
                      <div key={r.item_id} style={{background:"var(--surface)",borderRadius:"var(--r-md)",border:`1px solid ${checked?"var(--border-ac)":isLow?"rgba(239,68,68,0.4)":"var(--border)"}`,padding:"12px"}}>
                        <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
                          <input type="checkbox" checked={checked} onChange={(e)=>{
                            const next={...orderReqItems};
                            if(e.target.checked)next[r.item_id]="";
                            else delete next[r.item_id];
                            setOrderReqItems(next);
                          }} style={{marginTop:2,accentColor:"var(--ac)",width:16,height:16,flexShrink:0}} />
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <div style={{fontSize:13,fontWeight:700,color:"var(--text)",wordBreak:"break-word"}}>{r.name}</div>
                              {isLow && <span style={{fontSize:9,fontWeight:800,color:"#fca5a5",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,padding:"1px 6px"}}>LOW</span>}
                            </div>
                            <div style={{fontSize:11,color:"var(--text2)",marginTop:2}}>{r.vendor||"—"} · Ref: {r.reference_number||"—"} · {r.unit||"—"}</div>
                            <div style={{display:"flex",gap:10,marginTop:4}}>
                              <span style={{fontSize:11,fontWeight:700,color:"var(--ok)"}}>On Hand: {r.total_on_hand??0}</span>
                              <span style={{fontSize:11,fontWeight:700,color:"var(--ac-bright)"}}>PAR: {r.par_level??0}</span>
                            </div>
                          </div>
                        </label>
                        {checked && (
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingLeft:26}}>
                            <label style={{fontSize:11,color:"var(--text3)",fontWeight:700,flexShrink:0}}>QTY TO ORDER:</label>
                            <input type="number" min={1} value={qty} onChange={(e)=>setOrderReqItems({...orderReqItems,[r.item_id]:Number(e.target.value)||1})} className="inp" style={{width:80,textAlign:"center",padding:"6px 8px",fontSize:14,fontWeight:800}} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{position:"sticky",bottom:0,background:"var(--card)",paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",gap:10}}>
                  <button onClick={()=>setOrderReqOpen(false)} className="btn btn-gh" style={{flex:1}}>Cancel</button>
                  <button
                    disabled={orderReqSending||Object.keys(orderReqItems).length===0}
                    className="btn btn-ac"
                    style={{flex:1}}
                    onClick={async()=>{
                      const selectedItems=totals.filter(r=>orderReqItems[r.item_id]!==undefined).map(r=>({name:r.name,reference_number:r.reference_number||null,vendor:r.vendor||null,unit:r.unit||null,qty:Number(orderReqItems[r.item_id])||1}));
                      if(!selectedItems.length)return;
                      setOrderReqSending(true);
                      try{
                        const res=await fetch("/api/order-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:selectedItems,requested_by:(staffName||"").trim()||"Staff"})});
                        const json=await res.json();
                        if(!json.ok){alert(`Failed to send: ${json.error}`);}
                        else{setOrderReqDone(true);}
                      }catch(e:any){alert(`Error: ${e?.message}`);}
                      finally{setOrderReqSending(false);}
                    }}
                  >
                    {orderReqSending?"Sending…":`Send Request (${Object.keys(orderReqItems).length} items)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {namePromptOpen && (
        <div className="modal-ov">
          <div className="modal anim" style={{maxWidth:360}}>
            <div className="modal-title">👋 Welcome to Baxter ASC</div>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:16,lineHeight:1.6}}>Please enter your first and last name to get started. This is used to track all activity in the app.</div>
            <input
              value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              className="inp"
              placeholder="e.g., Brooklyn Carter"
              autoFocus
              onKeyDown={e=>{if(e.key==="Enter"&&nameInput.trim().length>=2){setStaffName(nameInput.trim());try{localStorage.setItem(LS.STAFF,nameInput.trim());}catch{}setNamePromptOpen(false);}}}
            />
            <div style={{fontSize:11,color:"var(--text4)",marginTop:6,marginBottom:16}}>Must be at least 2 characters. This is saved on your device.</div>
            <button
              onClick={()=>{if(nameInput.trim().length<2)return alert("Please enter your full name.");setStaffName(nameInput.trim());try{localStorage.setItem(LS.STAFF,nameInput.trim());}catch{}setNamePromptOpen(false);}}
              className="btn btn-submit btn-full btn-lg"
              disabled={nameInput.trim().length<2}
            >
              Start Using App
            </button>
          </div>
        </div>
      )}
    </>
  );
}
