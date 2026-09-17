"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useSessionTimeout } from "@/lib/use-session-timeout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ResultItem = {
  id: string;
  name: string;
  reference: string | null;
  on_hand: number;
  par: number;
  low: number;
  unit: string | null;
  vendor: string | null;
  price: number | null;
  order_status: string | null;
};

type ResultOrder = {
  item: string;
  status: string;
  requested: number | null;
  ordered: number | null;
  received: number | null;
  vendor: string | null;
  expected: string | null;
};

type ActionDraft = {
  type: string;
  item_id: string | null;
  item_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  summary: string;
  route: string;
  requires_confirmation: boolean;
};

type AssistantPayload = {
  answer: string;
  draft: ActionDraft | null;
  results: { items: ResultItem[]; orders: ResultOrder[] };
  safety: string;
};

type ConversationEntry = {
  id: string;
  question: string;
  response: AssistantPayload | null;
  error?: string;
};

type OperationsPriority = {
  id: string;
  name: string;
  reference: string | null;
  vendor: string | null;
  on_hand: number;
  par: number;
  low: number;
  unit: string | null;
  status: "OUT" | "LOW";
  backordered: boolean;
};

type OperationsSummary = {
  generated_at: string;
  metrics: {
    active_items: number;
    needs_attention: number;
    out_of_stock: number;
    open_orders: number;
    overdue_orders: number;
    backordered_orders: number;
    missing_prices: number;
    estimated_restock_cost: number;
  };
  priorities: OperationsPriority[];
  safety: string;
};

const SUGGESTIONS = [
  "What needs attention right now?",
  "How many Arthroscopy with Pouch do we have?",
  "Show pending and backordered items.",
  "Which items have pricing saved?",
];

const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#080d19;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
  .ai-root{min-height:100vh;color:#f8fafc;padding:14px 14px 100px;background:radial-gradient(circle at 18% 0%,rgba(37,99,235,.21),transparent 34%),radial-gradient(circle at 100% 24%,rgba(45,212,191,.09),transparent 30%),#080d19}
  .ai-wrap{width:100%;max-width:940px;margin:0 auto}
  .ai-hero{position:relative;overflow:hidden;border:1px solid rgba(96,165,250,.22);border-radius:24px;padding:19px;background:linear-gradient(145deg,rgba(30,41,59,.97),rgba(15,23,42,.97));box-shadow:0 25px 70px rgba(0,0,0,.28)}
  .ai-hero::before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2dd4bf)}
  .ai-hero-top{display:flex;align-items:center;gap:13px}
  .ai-mark{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#2563eb,#0891b2);box-shadow:0 13px 30px rgba(37,99,235,.34);font-size:23px}
  .ai-title{font-size:25px;font-weight:950;letter-spacing:-.75px;line-height:1.05}
  .ai-sub{font-size:11px;color:#94a3b8;margin-top:5px}
  .ai-live{margin-left:auto;display:flex;align-items:center;gap:7px;color:#6ee7b7;background:rgba(16,185,129,.08);border:1px solid rgba(52,211,153,.18);border-radius:999px;padding:7px 10px;font-size:9px;font-weight:900;letter-spacing:.5px;white-space:nowrap}
  .ai-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 13px rgba(52,211,153,.7)}
  .ai-safety{display:flex;gap:9px;align-items:flex-start;margin-top:15px;padding:10px 12px;border-radius:12px;background:rgba(14,165,233,.07);border:1px solid rgba(56,189,248,.14);color:#bae6fd;font-size:11px;line-height:1.45}
  .ai-back{border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.66);color:#94a3b8;border-radius:10px;padding:8px 12px;font:800 11px inherit;cursor:pointer;margin-bottom:10px}
  .ai-brief{margin-top:12px;border:1px solid rgba(96,165,250,.17);border-radius:20px;padding:14px;background:linear-gradient(145deg,rgba(15,23,42,.91),rgba(12,21,38,.95));box-shadow:0 16px 42px rgba(0,0,0,.2)}
  .ai-brief-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
  .ai-brief-title{font-size:14px;font-weight:950;color:#f8fafc}
  .ai-brief-sub{font-size:9px;color:#64748b;margin-top:3px}
  .ai-refresh{border:1px solid rgba(96,165,250,.2);background:rgba(37,99,235,.09);color:#93c5fd;border-radius:9px;padding:7px 10px;font:850 10px inherit;cursor:pointer}
  .ai-refresh:disabled{opacity:.45;cursor:not-allowed}
  .ai-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .ai-metric{min-width:0;border:1px solid rgba(148,163,184,.11);background:rgba(2,6,23,.35);border-radius:13px;padding:10px}
  .ai-metric-value{font-size:22px;line-height:1;font-weight:950;color:#f8fafc}
  .ai-metric-value.warn{color:#fbbf24}.ai-metric-value.danger{color:#fb7185}.ai-metric-value.good{color:#5eead4}
  .ai-metric-label{margin-top:6px;color:#64748b;font-size:8px;font-weight:900;letter-spacing:.55px;text-transform:uppercase}
  .ai-priority{display:flex;align-items-center;gap:9px;margin-top:8px;padding:9px;border:1px solid rgba(148,163,184,.09);background:rgba(2,6,23,.27);border-radius:11px}
  .ai-priority:first-child{margin-top:11px}
  .ai-priority-main{min-width:0;flex:1}
  .ai-priority-name{font-size:11px;font-weight:850;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ai-priority-meta{font-size:9px;color:#64748b;margin-top:3px}
  .ai-priority-count{font-size:11px;color:#fda4af;font-weight:900;white-space:nowrap}
  .ai-badge{display:inline-block;margin-left:5px;border-radius:999px;padding:2px 5px;background:rgba(245,158,11,.12);color:#fbbf24;font-size:7px;font-weight:900}
  .ai-brief-empty{padding:13px;text-align:center;color:#6ee7b7;font-size:11px}
  .ai-brief-error{padding:11px;border-radius:11px;background:rgba(239,68,68,.07);color:#fca5a5;font-size:11px}
  .ai-brief-foot{display:flex;justify-content:space-between;gap:8px;margin-top:10px;color:#526178;font-size:8px}
  .ai-suggestions{display:flex;gap:7px;overflow-x:auto;padding:13px 1px 10px;scrollbar-width:none}
  .ai-suggestions::-webkit-scrollbar{display:none}
  .ai-chip{flex:0 0 auto;border:1px solid rgba(96,165,250,.18);background:rgba(30,41,59,.66);color:#bfdbfe;border-radius:999px;padding:8px 11px;font:750 11px inherit;cursor:pointer}
  .ai-conversation{min-height:300px;border:1px solid rgba(96,165,250,.14);border-radius:20px;padding:14px;background:linear-gradient(180deg,rgba(8,13,25,.76),rgba(15,23,42,.83));box-shadow:inset 0 1px rgba(255,255,255,.025)}
  .ai-empty{padding:47px 20px;text-align:center;color:#64748b}
  .ai-empty-icon{width:58px;height:58px;border-radius:19px;margin:0 auto 13px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(37,99,235,.2),rgba(6,182,212,.08));border:1px solid rgba(96,165,250,.17);font-size:26px}
  .ai-empty strong{display:block;color:#cbd5e1;font-size:15px;margin-bottom:5px}
  .ai-entry{margin-bottom:17px}
  .ai-question{margin-left:auto;max-width:78%;width:max-content;background:linear-gradient(145deg,#2563eb,#1d4ed8);border:1px solid rgba(147,197,253,.22);border-radius:16px 5px 16px 16px;padding:10px 13px;font-size:13px;line-height:1.4;box-shadow:0 9px 25px rgba(37,99,235,.18)}
  .ai-answer{max-width:90%;margin-top:8px;background:linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.94));border:1px solid rgba(148,163,184,.14);border-radius:5px 17px 17px 17px;padding:13px;box-shadow:0 12px 28px rgba(0,0,0,.16)}
  .ai-label{font-size:9px;color:#67e8f9;font-weight:900;letter-spacing:.7px;text-transform:uppercase;margin-bottom:7px}
  .ai-copy{font-size:14px;color:#e2e8f0;line-height:1.55;white-space:pre-wrap}
  .ai-thinking{display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:12px}
  .ai-spinner{width:15px;height:15px;border-radius:50%;border:2px solid rgba(96,165,250,.2);border-top-color:#60a5fa;animation:ai-spin .8s linear infinite}
  @keyframes ai-spin{to{transform:rotate(360deg)}}
  .ai-error{color:#fca5a5}
  .ai-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;margin-top:10px}
  .ai-result{background:rgba(2,6,23,.38);border:1px solid rgba(148,163,184,.11);border-radius:11px;padding:9px 10px}
  .ai-result-name{font-size:11px;font-weight:850;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ai-result-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#64748b;font-size:9px}
  .ai-result-value{color:#93c5fd;font-weight:900}
  .ai-draft{margin-top:11px;padding:12px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.07);border-radius:13px}
  .ai-draft-title{color:#fcd34d;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.55px}
  .ai-draft-copy{font-size:12px;color:#fde68a;margin:6px 0 9px;line-height:1.4;text-transform:capitalize}
  .ai-draft-note{font-size:10px;color:#94a3b8;margin-bottom:9px}
  .ai-open{width:100%;border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.14);color:#fcd34d;border-radius:10px;padding:9px;font:850 11px inherit;cursor:pointer}
  .ai-composer{position:sticky;bottom:12px;margin-top:10px;padding:10px;background:linear-gradient(145deg,rgba(30,41,59,.95),rgba(15,23,42,.97));border:1px solid rgba(96,165,250,.2);border-radius:18px;box-shadow:0 20px 52px rgba(0,0,0,.42);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
  .ai-input-row{display:flex;align-items:flex-end;gap:8px}
  .ai-input{flex:1;resize:none;min-height:48px;max-height:130px;border-radius:12px;border:1px solid #334155;background:#0b1323;color:#f8fafc;padding:12px;font:14px/1.4 inherit;outline:none}
  .ai-send{height:48px;min-width:92px;border:0;border-radius:12px;background:linear-gradient(145deg,#2563eb,#0891b2);color:white;font:900 12px inherit;cursor:pointer;box-shadow:0 10px 24px rgba(37,99,235,.25)}
  .ai-send:disabled{opacity:.42;cursor:not-allowed}
  .ai-foot{display:flex;justify-content:space-between;gap:10px;margin-top:7px;font-size:9px;color:#526178}
  @media(max-width:600px){.ai-root{padding:9px 9px 102px}.ai-hero{padding:15px}.ai-title{font-size:21px}.ai-live{padding:6px 8px}.ai-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-conversation{padding:10px}.ai-question{max-width:88%}.ai-answer{max-width:96%}.ai-send{min-width:70px}.ai-results{grid-template-columns:1fr}}
`;

export default function AICommandCenterPage() {
  const router = useRouter();
  useSessionTimeout();

  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else {
        setAuthReady(true);
        const prefill = window.sessionStorage.getItem("asc_ai_prefill");
        if (prefill) {
          setDraft(prefill);
          window.sessionStorage.removeItem("asc_ai_prefill");
        }
      }
    });
  }, [router]);

  useEffect(() => {
    if (authReady) void loadOperationsSummary();
  }, [authReady]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, loading]);

  async function loadOperationsSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/ai-operations-summary", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "The operations briefing could not be loaded.");
      }
      setSummary({
        generated_at: result.generated_at,
        metrics: result.metrics,
        priorities: result.priorities || [],
        safety: result.safety,
      });
    } catch (error: any) {
      setSummaryError(error?.message || "The operations briefing could not be loaded.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function ask(questionOverride?: string) {
    const question = (questionOverride ?? draft).trim();
    if (!question || loading || !authReady) return;

    const id = crypto.randomUUID();
    setEntries(current => [...current, { id, question, response: null }]);
    setDraft("");
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/ai-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({ message: question }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "The AI could not complete that safely.");
      }

      setEntries(current =>
        current.map(entry =>
          entry.id === id
            ? {
                ...entry,
                response: {
                  answer: result.answer,
                  draft: result.draft || null,
                  results: result.results || { items: [], orders: [] },
                  safety: result.safety,
                },
              }
            : entry
        )
      );
    } catch (error: any) {
      setEntries(current =>
        current.map(entry =>
          entry.id === id ? { ...entry, error: error?.message || "AI request failed." } : entry
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="ai-root">
        <div className="ai-wrap">
          <button className="ai-back" onClick={() => router.push("/")}>← Dashboard</button>

          <section className="ai-hero">
            <div className="ai-hero-top">
              <div className="ai-mark">✦</div>
              <div>
                <div className="ai-title">AI Command Center</div>
                <div className="ai-sub">Ask about inventory, orders, pricing, and receiving in plain language</div>
              </div>
              <div className="ai-live"><span className="ai-dot" /> PROTECTED</div>
            </div>
            <div className="ai-safety">
              <span>🛡️</span>
              <span><strong>Safe mode:</strong> AI can read and prepare actions, but it cannot silently change inventory. Any draft opens the existing protected workflow for confirmation.</span>
            </div>
          </section>

          <section className="ai-brief" aria-live="polite">
            <div className="ai-brief-head">
              <div>
                <div className="ai-brief-title">Today’s Operations Briefing</div>
                <div className="ai-brief-sub">Live read-only analysis of inventory, ordering, and pricing</div>
              </div>
              <button className="ai-refresh" disabled={summaryLoading || !authReady} onClick={() => void loadOperationsSummary()}>
                {summaryLoading ? "Checking…" : "↻ Refresh"}
              </button>
            </div>

            {summaryError ? (
              <div className="ai-brief-error">{summaryError}</div>
            ) : !summary ? (
              <div className="ai-brief-empty">{summaryLoading ? "Reading live operations safely…" : "Preparing briefing…"}</div>
            ) : (
              <>
                <div className="ai-metrics">
                  <div className="ai-metric">
                    <div className={"ai-metric-value " + (summary.metrics.needs_attention ? "warn" : "good")}>{summary.metrics.needs_attention}</div>
                    <div className="ai-metric-label">Needs Attention</div>
                  </div>
                  <div className="ai-metric">
                    <div className={"ai-metric-value " + (summary.metrics.out_of_stock ? "danger" : "good")}>{summary.metrics.out_of_stock}</div>
                    <div className="ai-metric-label">Out of Stock</div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-value">{summary.metrics.open_orders}</div>
                    <div className="ai-metric-label">Open Orders</div>
                  </div>
                  <div className="ai-metric">
                    <div className={"ai-metric-value " + (summary.metrics.overdue_orders ? "danger" : "good")}>{summary.metrics.overdue_orders}</div>
                    <div className="ai-metric-label">Overdue</div>
                  </div>
                </div>

                {summary.priorities.slice(0, 5).map(item => (
                  <div className="ai-priority" key={item.id}>
                    <div className="ai-priority-main">
                      <div className="ai-priority-name">
                        {item.name}
                        {item.backordered && <span className="ai-badge">BACKORDERED</span>}
                      </div>
                      <div className="ai-priority-meta">{item.reference || "No reference"} · Low {item.low} · PAR {item.par}</div>
                    </div>
                    <div className="ai-priority-count">{item.on_hand} {item.unit || ""}</div>
                  </div>
                ))}

                {summary.priorities.length === 0 && (
                  <div className="ai-brief-empty">✓ No items with a configured low level currently need attention.</div>
                )}

                <div className="ai-brief-foot">
                  <span>{summary.metrics.missing_prices} items still need pricing</span>
                  <span>Updated {new Date(summary.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </>
            )}
          </section>

          <div className="ai-suggestions" aria-label="Suggested questions">
            {SUGGESTIONS.map(suggestion => (
              <button key={suggestion} className="ai-chip" disabled={loading} onClick={() => void ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>

          <section className="ai-conversation" aria-live="polite">
            {entries.length === 0 ? (
              <div className="ai-empty">
                <div className="ai-empty-icon">✦</div>
                <strong>Your inventory copilot is ready</strong>
                Ask a question, check stock, review orders, or describe something you received.
              </div>
            ) : (
              entries.map(entry => (
                <div className="ai-entry" key={entry.id}>
                  <div className="ai-question">{entry.question}</div>
                  {entry.error ? (
                    <div className="ai-answer ai-error">{entry.error}</div>
                  ) : entry.response ? (
                    <div className="ai-answer">
                      <div className="ai-label">ASC AI</div>
                      <div className="ai-copy">{entry.response.answer}</div>

                      {entry.response.results.items.length > 0 && (
                        <div className="ai-results">
                          {entry.response.results.items.slice(0, 6).map(item => (
                            <div className="ai-result" key={item.id}>
                              <div className="ai-result-name">{item.name}</div>
                              <div className="ai-result-meta">
                                <span>{item.reference || "No reference"}</span>
                                <span className="ai-result-value">{item.price !== null ? "$" + Number(item.price).toFixed(2) + " · " : ""}{item.on_hand} {item.unit || ""}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.response.results.orders.length > 0 && (
                        <div className="ai-results">
                          {entry.response.results.orders.slice(0, 6).map((order, index) => (
                            <div className="ai-result" key={order.item + "-" + index}>
                              <div className="ai-result-name">{order.item}</div>
                              <div className="ai-result-meta">
                                <span>{order.vendor || "Vendor not set"}</span>
                                <span className="ai-result-value">{order.status} · {order.received ?? order.ordered ?? order.requested ?? 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.response.draft && (
                        <div className="ai-draft">
                          <div className="ai-draft-title">Action Preview · Nothing Changed</div>
                          <div className="ai-draft-copy">{entry.response.draft.summary}</div>
                          <div className="ai-draft-note">Review the item and amount in the protected workflow before saving.</div>
                          <button className="ai-open" onClick={() => router.push(entry.response!.draft!.route)}>
                            Open Protected Workflow →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {loading && (
              <div className="ai-answer">
                <div className="ai-thinking"><span className="ai-spinner" /> Reading live inventory safely…</div>
              </div>
            )}
            <div ref={endRef} />
          </section>

          <section className="ai-composer">
            <div className="ai-input-row">
              <textarea
                className="ai-input"
                value={draft}
                maxLength={800}
                placeholder="Ask the ASC AI anything about inventory…"
                aria-label="Ask the AI command center"
                disabled={!authReady}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask();
                  }
                }}
              />
              <button className="ai-send" disabled={!draft.trim() || loading || !authReady} onClick={() => void ask()}>
                {loading ? "Thinking…" : "Ask AI"}
              </button>
            </div>
            <div className="ai-foot">
              <span>Live read-only data · No patient information</span>
              <span>{draft.length}/800</span>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
