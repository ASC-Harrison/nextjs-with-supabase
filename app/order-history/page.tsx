"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Order = {
  id: string;
  created_at: string;
  requested_by: string;
  item_name: string;
  reference_number: string | null;
  vendor: string | null;
  unit: string | null;
  qty_requested: number;
  qty_actual_ordered: number | null;
  qty_actual_received: number | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  received_by?: string | null;
  expected_delivery_date: string | null;
  item_id: string | null;
  notes: string | null;
  last_follow_up_note?: string | null;
  last_follow_up_by?: string | null;
  last_follow_up_at?: string | null;
  follow_up_count?: number | null;
  issue_note?: string | null;
  issue_reported_by?: string | null;
  issue_reported_at?: string | null;
  issue_previous_status?: string | null;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 60px;}
  .wrap{max-width:700px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:8px;font-family:inherit;}
  .header{background:linear-gradient(135deg,#162032,#111827);border:1px solid #1e3a5f;border-radius:20px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981);}
  .header-title{font-size:22px;font-weight:900;color:#f0f6ff;letter-spacing:-0.8px;margin-bottom:2px;}
  .header-sub{font-size:12px;color:#64748b;}
  .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px;margin-bottom:16px;}
  .stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:12px;text-align:center;color:inherit;font-family:inherit;width:100%;cursor:pointer;appearance:none;transition:border-color .15s,background .15s,transform .15s;}
  .stat:hover{border-color:#3b82f6;background:#18253a;}
  .stat:active{transform:scale(.98);}
  .stat.active{border-color:#60a5fa;background:rgba(37,99,235,.18);box-shadow:0 0 0 2px rgba(96,165,250,.18);}
  .stat:focus-visible{outline:3px solid rgba(96,165,250,.55);outline-offset:2px;}
  .stat-val{font-size:22px;font-weight:900;letter-spacing:-1px;}
  .stat-lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .inp{border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:10px 14px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:180px;}
  .inp-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:32px;flex:none;}
  .timeline{position:relative;padding-left:24px;}
  .timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:2px;background:#1e3a5f;}
  .tl-item{position:relative;margin-bottom:16px;}
  .tl-dot{position:absolute;left:-20px;top:14px;width:10px;height:10px;border-radius:50%;border:2px solid;}
  .tl-dot.PENDING{background:#162032;border-color:#f59e0b;}
  .tl-dot.ORDERED{background:#3b82f6;border-color:#3b82f6;}
  .tl-dot.BACKORDERED{background:#ef4444;border-color:#ef4444;}
  .tl-dot.RECEIVED{background:#10b981;border-color:#10b981;}
  .tl-dot.ISSUE{background:#f97316;border-color:#f97316;}
  .tl-card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:14px;}
  .tl-card.RECEIVED{border-color:rgba(16,185,129,0.3);}
  .tl-card.BACKORDERED{border-color:rgba(239,68,68,0.3);}
  .tl-card.ISSUE{border-color:rgba(249,115,22,0.45);}
  .tl-name{font-size:14px;font-weight:800;color:#f0f6ff;word-break:break-word;margin-bottom:4px;}
  .tl-meta{font-size:11px;color:#64748b;line-height:1.6;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;}
  .badge-pending{background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);}
  .badge-ordered{background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);}
  .badge-backordered{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  .badge-received{background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);}
  .badge-issue{background:rgba(249,115,22,0.15);color:#fdba74;border:1px solid rgba(249,115,22,0.35);}
  .view-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
  .view-tab{border:1px solid #1e3a5f;border-radius:11px;background:#111827;color:#94a3b8;padding:11px 12px;font:800 13px inherit;cursor:pointer;}
  .view-tab.active{background:#1d4ed8;border-color:#3b82f6;color:#fff;}
  .view-tab.issue-active{background:#c2410c;border-color:#f97316;color:#fff;}
  .timeline-steps{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
  .step{font-size:10px;color:#64748b;display:flex;align-items:center;gap:4px;}
  .step.done{color:#6ee7b7;}
  .step.active{color:#f0f6ff;font-weight:700;}
  .empty{text-align:center;padding:48px;color:#334155;font-size:13px;}
  .loading{text-align:center;padding:40px;color:#64748b;}
  .count{font-size:11px;color:#334155;margin-bottom:8px;}
  .order-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;}
  .receive-btn,.received-only-btn{width:100%;border:0;border-radius:10px;color:#fff;padding:11px 14px;font:800 13px inherit;cursor:pointer;}
  .receive-btn{background:#2563eb;}
  .receive-btn:hover{background:#1d4ed8;}
  .received-only-btn{background:#10b981;}
  .received-only-btn:hover{background:#059669;}
  .ordered-btn{grid-column:1/-1;width:100%;border:0;border-radius:10px;background:#2563eb;color:#fff;padding:11px 14px;font:800 13px inherit;cursor:pointer;}
  .ordered-btn:hover{background:#1d4ed8;}
  .ordered-btn:disabled{opacity:.55;cursor:not-allowed;}
  .receive-btn:disabled,.received-only-btn:disabled{opacity:.55;cursor:not-allowed;}
  .followup-btn{grid-column:1/-1;width:100%;border:1px solid rgba(168,85,247,.3);border-radius:10px;background:rgba(168,85,247,.15);color:#d8b4fe;padding:10px 14px;font:800 12px inherit;cursor:pointer;}
  .followup-btn:disabled{opacity:.55;cursor:not-allowed;}
  .issue-btn{grid-column:1/-1;width:100%;border:1px solid rgba(249,115,22,.35);border-radius:10px;background:rgba(249,115,22,.13);color:#fdba74;padding:10px 14px;font:800 12px inherit;cursor:pointer;}
  .resolve-issue-btn{grid-column:1/-1;width:100%;border:0;border-radius:10px;background:#2563eb;color:#fff;padding:11px 14px;font:800 13px inherit;cursor:pointer;}
  .issue-btn:disabled,.resolve-issue-btn:disabled{opacity:.55;cursor:not-allowed;}
`;

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orderView, setOrderView] = useState<"ALL" | "ORDERS" | "ISSUES">("ORDERS");
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpSending, setFollowUpSending] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<Order | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receivePrice, setReceivePrice] = useState("");
  const [receiveUnitsPerPackage, setReceiveUnitsPerPackage] = useState("1");
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receivedOnlyOrder, setReceivedOnlyOrder] = useState<Order | null>(null);
  const [receivedOnlyQty, setReceivedOnlyQty] = useState("");
  const [receivedOnlySaving, setReceivedOnlySaving] = useState(false);
  const [issueOrder, setIssueOrder] = useState<Order | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const loadHistory = () => {
      supabase
        .from("order_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)
        .then(({ data }) => {
          setOrders((data as Order[]) ?? []);
          setLoading(false);
        });
    };
    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadHistory, 250);
    };
    loadHistory();
    const channel = supabase
      .channel("order-history-live-sync")
      .on("postgres_changes", { event:"*", schema:"public", table:"order_requests" }, refreshSoon)
      .subscribe();
    const onFocus = () => loadHistory();
    const onVisibility = () => { if (document.visibilityState === "visible") loadHistory(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, []);

  const staffList = useMemo(() => {
    const set = new Set(orders.map(o => o.requested_by));
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orderView === "ALL" ? orders : orderView === "ISSUES" ? orders.filter(o => o.status === "ISSUE") : orders.filter(o => o.status !== "ISSUE");
    if (statusFilter !== "ALL") list = list.filter(o => o.status === statusFilter);
    if (staffFilter !== "ALL") list = list.filter(o => o.requested_by === staffFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.item_name || "").toLowerCase().includes(q) ||
        (o.vendor || "").toLowerCase().includes(q) ||
        (o.reference_number || "").toLowerCase().includes(q) ||
        (o.requested_by || "").toLowerCase().includes(q) ||
        (o.notes || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, orderView, statusFilter, staffFilter, search]);

  const totalOrders = orders.length;
  const totalReceived = orders.filter(o => o.status === "RECEIVED").length;
  const totalPending = orders.filter(o => o.status === "PENDING").length;
  const totalOrdered = orders.filter(o => o.status === "ORDERED").length;
  const totalBackordered = orders.filter(o => o.status === "BACKORDERED").length;
  const totalIssues = orders.filter(o => o.status === "ISSUE").length;

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function formatTime(ts: string) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function getBadgeClass(status: string) {
    if (status === "PENDING") return "badge badge-pending";
    if (status === "ORDERED") return "badge badge-ordered";
    if (status === "BACKORDERED") return "badge badge-backordered";
    if (status === "ISSUE") return "badge badge-issue";
    return "badge badge-received";
  }

  function openAddToInventory(order: Order) {
    const orderedQty = order.qty_actual_ordered || order.qty_requested;
    const alreadyReceived = order.qty_actual_received || 0;
    setReceiveQty(String(Math.max(orderedQty - alreadyReceived, 1)));
    setReceivePrice("");
    setReceiveUnitsPerPackage("1");
    setReceivingOrder(order);
  }

  async function addReceivedInventory() {
    if (!receivingOrder || receiveSaving) return;
    const qty = Number(receiveQty);
    const packagePrice = receivePrice.trim() ? Number(receivePrice) : null;
    const packageQty = Number(receiveUnitsPerPackage || "1");
    if (!Number.isInteger(qty) || qty <= 0) {
      alert("Enter a valid whole-number quantity received.");
      return;
    }
    if (packagePrice !== null && (!Number.isFinite(packagePrice) || packagePrice < 0)) {
      alert("Enter a valid invoice price.");
      return;
    }
    if (!Number.isInteger(packageQty) || packageQty < 1) {
      alert("Units in the package must be at least 1.");
      return;
    }
    if (!confirm(`Add ${qty} of "${receivingOrder.item_name}" to Main Sterile Supply and mark this order received?`)) return;

    setReceiveSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const staff = session?.user?.user_metadata?.full_name || session?.user?.email || "Administrator";
      const { data, error } = await supabase.rpc("receive_order_with_pricing", {
        p_order_id: receivingOrder.id,
        p_qty: qty,
        p_complete: true,
        p_staff: staff,
        p_partial_note: null,
        p_package_price: packagePrice,
        p_units_per_package: packagePrice === null ? null : packageQty,
        p_vendor: packagePrice === null ? null : receivingOrder.vendor || null,
        p_price_source: packagePrice === null ? null : "Invoice",
      });
      if (error) throw error;
      const result = data as { status: Order["status"]; total_received: number; inventory_on_hand: number; package_price: number | null; unit_cost: number | null; };
      const receivedAt = new Date().toISOString();
      setOrders(prev => prev.map(row => row.id === receivingOrder.id ? {
        ...row,
        status: result.status,
        qty_actual_received: result.total_received,
        received_at: receivedAt,
      } : row));
      const previousOnHand = result.inventory_on_hand - qty;
      setReceivingOrder(null);
      alert(`Inventory updated: ${previousOnHand} previously on hand + ${qty} received = ${result.inventory_on_hand} now in Main Sterile Supply.`);
    } catch (error) {
      alert(`Could not receive this order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setReceiveSaving(false);
    }
  }

  function openReceivedOnly(order: Order) {
    const orderedQty = order.qty_actual_ordered || order.qty_requested;
    const alreadyReceived = order.qty_actual_received || 0;
    setReceivedOnlyQty(String(Math.max(orderedQty - alreadyReceived, 1)));
    setReceivedOnlyOrder(order);
  }

  async function markOrdered(order: Order) {
    if (updatingOrderId) return;
    if (order.notes && !confirm(`Please confirm you read this note before marking the item ordered:\n\n"${order.notes}"`)) return;

    setUpdatingOrderId(order.id);
    const confirmedAt = new Date().toISOString();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const staff = session?.user?.user_metadata?.full_name || session?.user?.email || "Administrator";
      const update: Record<string, string> = {
        status: "ORDERED",
        confirmed_by: staff,
        confirmed_at: confirmedAt,
      };
      if (order.notes) {
        update.note_acknowledged_by = staff;
        update.note_acknowledged_at = confirmedAt;
      }

      const { error } = await supabase
        .from("order_requests")
        .update(update)
        .eq("id", order.id)
        .select("id")
        .single();
      if (error) throw error;

      setOrders(prev => prev.map(row =>
        row.id === order.id
          ? { ...row, status: "ORDERED", confirmed_by: staff, confirmed_at: confirmedAt }
          : row
      ));
    } catch (error) {
      alert(`Could not mark this order as ordered: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function saveReceivedOnly() {
    if (!receivedOnlyOrder || receivedOnlySaving) return;
    const qtyThisDelivery = Number(receivedOnlyQty);
    if (!Number.isInteger(qtyThisDelivery) || qtyThisDelivery <= 0) {
      alert("Enter a valid whole-number amount received.");
      return;
    }
    const alreadyReceived = receivedOnlyOrder.qty_actual_received || 0;
    const totalReceived = alreadyReceived + qtyThisDelivery;
    if (!confirm(`Mark "${receivedOnlyOrder.item_name}" received and record ${qtyThisDelivery} received this delivery?

This will not add or change inventory.`)) return;

    setReceivedOnlySaving(true);
    const receivedAt = new Date().toISOString();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const staff = session?.user?.user_metadata?.full_name || session?.user?.email || "Administrator";
      const { error } = await supabase
        .from("order_requests")
        .update({
          status: "RECEIVED",
          qty_actual_received: totalReceived,
          received_at: receivedAt,
          received_by: staff,
        })
        .eq("id", receivedOnlyOrder.id)
        .select("id")
        .single();

      if (error) throw error;

      setOrders(prev => prev.map(row =>
        row.id === receivedOnlyOrder.id
          ? { ...row, status: "RECEIVED", qty_actual_received: totalReceived, received_at: receivedAt, received_by: staff }
          : row
      ));
      setReceivedOnlyOrder(null);
      alert(`Received quantity saved: ${qtyThisDelivery} this delivery, ${totalReceived} total received. Inventory was not changed.`);
    } catch (error) {
      alert(`Could not mark this order received: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setReceivedOnlySaving(false);
    }
  }

  async function markAsIssue() {
    if (!issueOrder || issueSaving) return;
    const note = issueNote.trim();
    if (!note) return alert("Please describe the issue first.");
    setIssueSaving(true);
    const reportedAt = new Date().toISOString();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const staff = session?.user?.user_metadata?.full_name || session?.user?.email || "Administrator";
      const { error } = await supabase.from("order_requests").update({
        status: "ISSUE",
        issue_note: note,
        issue_reported_by: staff,
        issue_reported_at: reportedAt,
        issue_previous_status: issueOrder.status,
      }).eq("id", issueOrder.id).select("id").single();
      if (error) throw error;
      setOrders(prev => prev.map(row => row.id === issueOrder.id ? { ...row, status:"ISSUE", issue_note:note, issue_reported_by:staff, issue_reported_at:reportedAt, issue_previous_status:issueOrder.status } : row));
      setIssueOrder(null);
      setIssueNote("");
      setOrderView("ISSUES");
    } catch (error) {
      alert(`Could not move this order to Issues: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIssueSaving(false);
    }
  }

  async function resolveIssue(order: Order) {
    if (issueSaving) return;
    const restoredStatus = order.issue_previous_status && order.issue_previous_status !== "ISSUE" ? order.issue_previous_status : "ORDERED";
    if (!confirm(`Move "${order.item_name}" out of Issues and back to ${restoredStatus.toLowerCase()}?`)) return;
    setIssueSaving(true);
    try {
      const { error } = await supabase.from("order_requests").update({
        status: restoredStatus,
        issue_note: null,
        issue_reported_by: null,
        issue_reported_at: null,
        issue_previous_status: null,
      }).eq("id", order.id).select("id").single();
      if (error) throw error;
      setOrders(prev => prev.map(row => row.id === order.id ? { ...row, status:restoredStatus, issue_note:null, issue_reported_by:null, issue_reported_at:null, issue_previous_status:null } : row));
    } catch (error) {
      alert(`Could not resolve this issue: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIssueSaving(false);
    }
  }

  async function sendFollowUp(order: Order) {
    const note = followUpNote.trim();
    if (!note) return alert("Type a note for Brooklyn first.");
    setFollowUpSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const res = await fetch("/api/order-follow-up", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}` },
        body: JSON.stringify({ order_id:order.id, note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not send follow-up");
      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        last_follow_up_note:json.follow_up.note,
        last_follow_up_by:json.follow_up.sent_by,
        last_follow_up_at:json.follow_up.sent_at,
        follow_up_count:json.follow_up.count,
      } : o));
      setFollowUpId(null);
      setFollowUpNote("");
      alert("Follow-up sent to Brooklyn.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not send follow-up");
    } finally {
      setFollowUpSending(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          {receivingOrder && (
            <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(2,6,23,.82)",display:"grid",placeItems:"center",padding:16}} onClick={()=>{if(!receiveSaving)setReceivingOrder(null);}}>
              <div style={{width:"min(430px,100%)",background:"#111827",border:"1px solid rgba(96,165,250,.28)",borderRadius:18,padding:18,boxShadow:"0 24px 70px rgba(0,0,0,.55)"}} onClick={event=>event.stopPropagation()}>
                <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>📦 Add & Receive</div>
                <div style={{fontSize:13,color:"#cbd5e1",marginBottom:16}}>{receivingOrder.item_name}</div>
                <label style={{display:"block",fontSize:11,fontWeight:800,color:"#94a3b8",marginBottom:5}}>AMOUNT RECEIVED</label>
                <input className="inp" inputMode="numeric" value={receiveQty} onChange={event=>setReceiveQty(event.target.value.replace(/\D/g,""))} style={{marginBottom:12,fontSize:18,fontWeight:900,textAlign:"center"}} />
                <label style={{display:"block",fontSize:11,fontWeight:800,color:"#94a3b8",marginBottom:5}}>INVOICE PRICE PER PACKAGE (OPTIONAL)</label>
                <input className="inp" inputMode="decimal" value={receivePrice} onChange={event=>setReceivePrice(event.target.value.replace(/[^0-9.]/g,""))} placeholder="Leave blank if unknown" style={{marginBottom:12}} />
                {receivePrice.trim() && (
                  <>
                    <label style={{display:"block",fontSize:11,fontWeight:800,color:"#94a3b8",marginBottom:5}}>UNITS IN PACKAGE</label>
                    <input className="inp" inputMode="numeric" value={receiveUnitsPerPackage} onChange={event=>setReceiveUnitsPerPackage(event.target.value.replace(/\D/g,""))} style={{marginBottom:12}} />
                  </>
                )}
                <div style={{fontSize:11,color:"#64748b",lineHeight:1.5,marginBottom:14}}>This adds the amount to the existing Main Sterile Supply count and marks this order received. It does not replace the old count.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <button type="button" className="received-only-btn" style={{background:"#334155"}} disabled={receiveSaving} onClick={()=>setReceivingOrder(null)}>Cancel</button>
                  <button type="button" className="receive-btn" disabled={receiveSaving} onClick={addReceivedInventory}>{receiveSaving ? "Adding…" : "Add & Receive"}</button>
                </div>
              </div>
            </div>
          )}
          {receivedOnlyOrder && (
            <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(2,6,23,.82)",display:"grid",placeItems:"center",padding:16}} onClick={()=>{if(!receivedOnlySaving)setReceivedOnlyOrder(null);}}>
              <div style={{width:"min(430px,100%)",background:"#111827",border:"1px solid rgba(16,185,129,.3)",borderRadius:18,padding:18,boxShadow:"0 24px 70px rgba(0,0,0,.55)"}} onClick={event=>event.stopPropagation()}>
                <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>✅ Mark Received</div>
                <div style={{fontSize:13,color:"#cbd5e1",marginBottom:16}}>{receivedOnlyOrder.item_name}</div>
                <label style={{display:"block",fontSize:11,fontWeight:800,color:"#94a3b8",marginBottom:5}}>AMOUNT RECEIVED THIS DELIVERY</label>
                <input className="inp" inputMode="numeric" value={receivedOnlyQty} onChange={event=>setReceivedOnlyQty(event.target.value.replace(/\D/g,""))} style={{marginBottom:12,fontSize:18,fontWeight:900,textAlign:"center"}} />
                <div style={{fontSize:11,color:"#fcd34d",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,padding:"8px 10px",lineHeight:1.5,marginBottom:14}}>This records the actual amount received on the order only. It will not add to or change inventory.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <button type="button" className="received-only-btn" style={{background:"#334155"}} disabled={receivedOnlySaving} onClick={()=>setReceivedOnlyOrder(null)}>Cancel</button>
                  <button type="button" className="received-only-btn" disabled={receivedOnlySaving} onClick={saveReceivedOnly}>{receivedOnlySaving ? "Saving…" : "Save Received"}</button>
                </div>
              </div>
            </div>
          )}
          {issueOrder && (
            <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(2,6,23,.82)",display:"grid",placeItems:"center",padding:16}} onClick={()=>{if(!issueSaving)setIssueOrder(null);}}>
              <div style={{width:"min(430px,100%)",background:"#111827",border:"1px solid rgba(249,115,22,.35)",borderRadius:18,padding:18,boxShadow:"0 24px 70px rgba(0,0,0,.55)"}} onClick={event=>event.stopPropagation()}>
                <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>⚠️ Move to Issues</div>
                <div style={{fontSize:13,color:"#cbd5e1",marginBottom:14}}>{issueOrder.item_name}</div>
                <label style={{display:"block",fontSize:11,fontWeight:800,color:"#fdba74",marginBottom:5}}>WHAT IS THE ISSUE?</label>
                <textarea value={issueNote} onChange={event=>setIssueNote(event.target.value.slice(0,500))} rows={4} placeholder="Example: Wrong quantity delivered, damaged box, or vendor follow-up needed." style={{width:"100%",borderRadius:9,border:"1px solid rgba(249,115,22,.3)",background:"#0f172a",color:"#f0f6ff",padding:"10px 11px",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",marginBottom:12}} />
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.5,marginBottom:14}}>This only moves the order into the Issues view. It will not change the item or inventory count.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <button type="button" className="received-only-btn" style={{background:"#334155"}} disabled={issueSaving} onClick={()=>setIssueOrder(null)}>Cancel</button>
                  <button type="button" className="received-only-btn" style={{background:"#ea580c"}} disabled={issueSaving || !issueNote.trim()} onClick={markAsIssue}>{issueSaving ? "Moving…" : "Move to Issues"}</button>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>

          <div className="header">
            <div className="header-title">📋 Order History</div>
            <div className="header-sub">Complete timeline of all order requests and their status</div>
          </div>

          <div className="stats-row">
            <button type="button" className={`stat ${orderView === "ALL" ? "active" : ""}`} aria-pressed={orderView === "ALL"} onClick={()=>{setOrderView("ALL");setStatusFilter("ALL");}}>
              <div className="stat-val">{totalOrders}</div>
              <div className="stat-lbl">Total</div>
            </button>
            <button type="button" className={`stat ${orderView === "ORDERS" && statusFilter === "PENDING" ? "active" : ""}`} aria-pressed={orderView === "ORDERS" && statusFilter === "PENDING"} onClick={()=>{setOrderView("ORDERS");setStatusFilter("PENDING");}}>
              <div className="stat-val" style={{ color:"#fcd34d" }}>{totalPending}</div>
              <div className="stat-lbl">Pending</div>
            </button>
            <button type="button" className={`stat ${orderView === "ORDERS" && statusFilter === "ORDERED" ? "active" : ""}`} aria-pressed={orderView === "ORDERS" && statusFilter === "ORDERED"} onClick={()=>{setOrderView("ORDERS");setStatusFilter("ORDERED");}}>
              <div className="stat-val" style={{ color:"#60a5fa" }}>{totalOrdered}</div>
              <div className="stat-lbl">Ordered</div>
            </button>
            <button type="button" className={`stat ${orderView === "ORDERS" && statusFilter === "BACKORDERED" ? "active" : ""}`} aria-pressed={orderView === "ORDERS" && statusFilter === "BACKORDERED"} onClick={()=>{setOrderView("ORDERS");setStatusFilter("BACKORDERED");}}>
              <div className="stat-val" style={{ color:"#fca5a5" }}>{totalBackordered}</div>
              <div className="stat-lbl">Backordered</div>
            </button>
            <button type="button" className={`stat ${orderView === "ORDERS" && statusFilter === "RECEIVED" ? "active" : ""}`} aria-pressed={orderView === "ORDERS" && statusFilter === "RECEIVED"} onClick={()=>{setOrderView("ORDERS");setStatusFilter("RECEIVED");}}>
              <div className="stat-val" style={{ color:"#6ee7b7" }}>{totalReceived}</div>
              <div className="stat-lbl">Received</div>
            </button>
            <button type="button" className={`stat ${orderView === "ISSUES" ? "active" : ""}`} aria-pressed={orderView === "ISSUES"} onClick={()=>{setOrderView("ISSUES");setStatusFilter("ALL");}}>
              <div className="stat-val" style={{ color:"#fdba74" }}>{totalIssues}</div>
              <div className="stat-lbl">Issues</div>
            </button>
          </div>

          <div className="view-tabs">
            <button type="button" className={`view-tab ${orderView === "ORDERS" ? "active" : ""}`} onClick={()=>{setOrderView("ORDERS");setStatusFilter("ALL");}}>📋 Orders ({totalOrders - totalIssues})</button>
            <button type="button" className={`view-tab ${orderView === "ISSUES" ? "issue-active" : ""}`} onClick={()=>{setOrderView("ISSUES");setStatusFilter("ALL");}}>⚠️ Issues ({totalIssues})</button>
          </div>

          <div className="controls">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, vendor, staff…" className="inp" />
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="inp inp-sel">
              <option value="ALL">All Staff</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="count">Showing {filtered.length} of {totalOrders} orders</div>

          {loading ? (
            <div className="loading">Loading order history…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No orders match your filters.</div>
          ) : (
            <div className="timeline">
              {filtered.map(order => (
                <div key={order.id} className="tl-item">
                  <div className={"tl-dot " + order.status} />
                  <div className={"tl-card " + order.status}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                      <div className="tl-name">{order.item_name}</div>
                      <span className={getBadgeClass(order.status)}>{order.status}</span>
                    </div>
                    <div className="tl-meta">
                      {order.vendor || "—"} · {order.reference_number ? `Ref: ${order.reference_number}` : "No ref"} · {order.unit || "—"}<br />
                      <strong style={{ color:"#f0f6ff" }}>Requested by: {order.requested_by}</strong> · {formatDate(order.created_at)}<br />
                      Qty Requested: <strong style={{ color:"#f0f6ff" }}>{order.qty_requested}</strong>
                      {order.qty_actual_ordered && order.qty_actual_ordered !== order.qty_requested && (
                        <span style={{ color:"#fcd34d" }}> → Actual Ordered: <strong>{order.qty_actual_ordered}</strong></span>
                      )}
                      {order.qty_actual_received && (
                        <span style={{ color:"#6ee7b7" }}> · Received: <strong>{order.qty_actual_received}</strong></span>
                      )}
                    </div>
                    {order.notes && order.status !== "RECEIVED" && (
                      <div style={{ fontSize:12, color:"#93c5fd", marginTop:8, marginBottom:8, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:7, padding:"7px 9px", lineHeight:1.45 }}>
                        📝 <strong>Note for Brooklyn:</strong> {order.notes}
                      </div>
                    )}
                    {order.issue_note && (
                      <div style={{fontSize:12,color:"#fed7aa",marginTop:8,background:"rgba(249,115,22,.1)",border:"1px solid rgba(249,115,22,.3)",borderRadius:7,padding:"8px 9px",lineHeight:1.45}}>
                        ⚠️ <strong>Issue:</strong> {order.issue_note}
                        {order.issue_reported_at && <><br /><span style={{color:"#94a3b8"}}>{order.issue_reported_by || "Staff"} · {formatTime(order.issue_reported_at)}</span></>}
                      </div>
                    )}
                    {order.last_follow_up_note && order.last_follow_up_at && (
                      <div style={{ fontSize:11, color:"#d8b4fe", marginTop:8, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:7, padding:"7px 9px", lineHeight:1.45 }}>
                        💬 <strong>Last follow-up:</strong> {order.last_follow_up_note}<br />
                        <span style={{ color:"#64748b" }}>{order.last_follow_up_by || "Staff"} · {formatTime(order.last_follow_up_at)}{(order.follow_up_count || 0) > 1 ? ` · ${order.follow_up_count} follow-ups` : ""}</span>
                      </div>
                    )}

                    <div className="timeline-steps">
                      <div className={"step done"}>
                        ✓ Requested {formatDate(order.created_at)}
                      </div>
                      {order.confirmed_at && (
                        <div className="step done">
                          → {order.status === "BACKORDERED" ? "🔴 Backordered" : "✓ Ordered"} {formatTime(order.confirmed_at)}
                          {order.confirmed_by && <span style={{ color:"#64748b" }}> by {order.confirmed_by}</span>}
                        </div>
                      )}
                      {order.expected_delivery_date && order.status !== "RECEIVED" && (
                        <div className="step active">
                          📅 Expected: {formatDate(order.expected_delivery_date + "T00:00:00")}
                        </div>
                      )}
                      {order.received_at && (
                        <div className="step done">
                          ✓ Received {formatTime(order.received_at)}
                        </div>
                      )}
                    </div>
                    {followUpId === order.id && (
                      <div style={{ marginTop:12, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:10, padding:12 }}>
                        <div style={{ fontSize:12, color:"#d8b4fe", fontWeight:800, marginBottom:6 }}>Send Brooklyn a follow-up about this item</div>
                        <textarea value={followUpNote} onChange={e=>setFollowUpNote(e.target.value.slice(0,500))} rows={3} placeholder="Can we please follow up on this item? We have not received it yet." style={{ width:"100%", borderRadius:8, border:"1px solid rgba(168,85,247,0.3)", background:"#111827", color:"#f0f6ff", padding:"9px 10px", fontSize:12, fontFamily:"inherit", outline:"none", resize:"vertical", marginBottom:8 }} />
                        <div style={{ display:"flex", gap:8 }}>
                          <button type="button" onClick={()=>sendFollowUp(order)} disabled={followUpSending || !followUpNote.trim()} style={{ flex:1, border:0, borderRadius:8, background:"#7c3aed", color:"#fff", padding:"10px", fontWeight:800 }}>
                            {followUpSending ? "Sending…" : "✉️ Send to Brooklyn"}
                          </button>
                          <button type="button" onClick={()=>{setFollowUpId(null);setFollowUpNote("");}} disabled={followUpSending} style={{ border:"1px solid #1e3a5f", borderRadius:8, background:"#1e2d42", color:"#94a3b8", padding:"10px 14px", fontWeight:800 }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {["PENDING", "ORDERED", "BACKORDERED", "AWAITING"].includes(order.status) && (
                      <div className="order-actions">
                        {order.status === "PENDING" && (
                          <button
                            type="button"
                            className="ordered-btn"
                            disabled={updatingOrderId === order.id}
                            onClick={() => markOrdered(order)}
                          >
                            {updatingOrderId === order.id ? "Saving…" : "✅ Mark Ordered"}
                          </button>
                        )}
                        {followUpId !== order.id && (
                          <button
                            type="button"
                            className="followup-btn"
                            disabled={updatingOrderId === order.id}
                            onClick={()=>{setFollowUpId(order.id);setFollowUpNote("Can we please follow up on this item? We have not received it yet.");}}
                          >
                            💬 Follow Up With Brooklyn
                          </button>
                        )}
                        <button
                          type="button"
                          className="receive-btn"
                          disabled={updatingOrderId === order.id}
                          onClick={() => openAddToInventory(order)}
                        >
                          📦 Add to Inventory
                        </button>
                        <button
                          type="button"
                          className="received-only-btn"
                          disabled={updatingOrderId === order.id}
                          onClick={() => openReceivedOnly(order)}
                        >
                          {updatingOrderId === order.id ? "Saving…" : "✅ Received"}
                        </button>
                        <button type="button" className="issue-btn" disabled={issueSaving} onClick={()=>{setIssueOrder(order);setIssueNote("");}}>⚠️ Move to Issues</button>
                      </div>
                    )}
                    {order.status === "ISSUE" && (
                      <div className="order-actions">
                        <button type="button" className="resolve-issue-btn" disabled={issueSaving} onClick={()=>resolveIssue(order)}>{issueSaving ? "Saving…" : "✓ Resolve / Move Back"}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
