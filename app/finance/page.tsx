"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: "expense" | "income";
};

type Budget = {
  category: string;
  monthlyLimit: number;
};

type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimum: number;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate: string;
};

type FinanceState = {
  monthlyIncome: number;
  cashBalance: number;
  investmentBalance: number;
  propertyValue: number;
  mortgageBalance: number;
  emergencyTarget: number;
  transactions: Transaction[];
  budgets: Budget[];
  debts: Debt[];
  goals: Goal[];
};

const STORAGE_KEY = "finance-copilot-v1";

const DEFAULT_STATE: FinanceState = {
  monthlyIncome: 0,
  cashBalance: 0,
  investmentBalance: 0,
  propertyValue: 0,
  mortgageBalance: 0,
  emergencyTarget: 0,
  transactions: [],
  budgets: [
    { category: "Housing", monthlyLimit: 0 },
    { category: "Food", monthlyLimit: 0 },
    { category: "Transportation", monthlyLimit: 0 },
    { category: "Utilities", monthlyLimit: 0 },
    { category: "Shopping", monthlyLimit: 0 },
    { category: "Entertainment", monthlyLimit: 0 },
  ],
  debts: [],
  goals: [],
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const pct = (value: number) => Math.max(0, Math.min(100, value));

const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#07101b;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
  button,input,select{font:inherit}
  .f-root{min-height:100vh;color:#edf7f6;padding:18px 18px 110px;background:
    radial-gradient(circle at 15% 0%,rgba(16,185,129,.15),transparent 28%),
    radial-gradient(circle at 100% 20%,rgba(14,165,233,.10),transparent 30%),#07101b}
  .f-wrap{width:100%;max-width:1480px;margin:0 auto}
  .f-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .f-back{border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.6);color:#a7b8c8;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}
  .f-brand{display:flex;align-items:center;gap:10px}
  .f-logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#10b981,#0284c7);box-shadow:0 14px 34px rgba(16,185,129,.18)}
  .f-title{font-size:24px;font-weight:950;letter-spacing:-.75px}
  .f-sub{font-size:11px;color:#8396aa;margin-top:3px}
  .f-secure{margin-left:auto;display:flex;align-items:center;gap:7px;border:1px solid rgba(52,211,153,.18);background:rgba(16,185,129,.07);color:#86efac;border-radius:999px;padding:8px 11px;font-size:10px;font-weight:900}
  .f-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,.8fr);gap:14px}
  .f-left,.f-right{display:grid;gap:14px;align-content:start}
  .f-hero{border:1px solid rgba(148,163,184,.14);border-radius:26px;padding:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(9,18,31,.96));box-shadow:0 25px 70px rgba(0,0,0,.28)}
  .f-hero-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .f-eyebrow{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#6ee7b7;font-weight:900}
  .f-net{font-size:36px;font-weight:950;letter-spacing:-1.2px;margin-top:5px}
  .f-muted{font-size:11px;color:#7f93a8;line-height:1.45}
  .f-score{width:90px;height:90px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#10b981 var(--score),rgba(148,163,184,.15) 0);position:relative}
  .f-score:after{content:'';position:absolute;inset:8px;border-radius:50%;background:#0b1523}
  .f-score strong{position:relative;z-index:1;font-size:23px}
  .f-score span{position:absolute;z-index:1;margin-top:34px;font-size:8px;color:#91a2b5;font-weight:800}
  .f-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:15px}
  .f-stat{border:1px solid rgba(148,163,184,.12);border-radius:15px;padding:12px;background:rgba(15,23,42,.62)}
  .f-stat-top{display:flex;align-items:center;justify-content:space-between;color:#8ca0b5;font-size:10px}
  .f-stat strong{display:block;font-size:20px;margin-top:8px}
  .f-positive{color:#6ee7b7}.f-negative{color:#fda4af}
  .f-panel{border:1px solid rgba(148,163,184,.14);border-radius:22px;padding:16px;background:rgba(10,19,32,.92)}
  .f-panel-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}
  .f-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(14,165,233,.09);color:#7dd3fc}
  .f-panel-title{font-size:15px;font-weight:900}
  .f-panel-sub{font-size:10px;color:#74879b;margin-top:2px}
  .f-action{margin-left:auto;border:1px solid rgba(52,211,153,.18);background:rgba(16,185,129,.08);color:#86efac;border-radius:10px;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}
  .f-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:8px;margin-bottom:13px}
  .f-input,.f-select{width:100%;border:1px solid #26384d;background:#0b1523;color:#e8f3f2;border-radius:11px;padding:10px 11px;outline:none}
  .f-add{border:0;border-radius:11px;padding:0 14px;background:linear-gradient(145deg,#10b981,#0284c7);color:white;font-weight:900;cursor:pointer}
  .f-table{display:grid;gap:7px}
  .f-row{display:grid;grid-template-columns:1.2fr .8fr .8fr auto;align-items:center;gap:10px;padding:10px 11px;border:1px solid rgba(148,163,184,.10);border-radius:12px;background:rgba(15,23,42,.46)}
  .f-row strong{font-size:12px}.f-row span{font-size:10px;color:#7f93a8}
  .f-amount{font-size:12px!important;font-weight:900!important}
  .f-budget{display:grid;gap:10px}
  .f-budget-row{display:grid;grid-template-columns:135px 1fr 120px;align-items:center;gap:10px}
  .f-budget-name{font-size:11px;font-weight:850}
  .f-track{height:9px;border-radius:999px;background:#152335;overflow:hidden}
  .f-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#10b981,#38bdf8)}
  .f-budget-values{text-align:right;font-size:10px;color:#8196ab}
  .f-debt-list,.f-goal-list{display:grid;gap:8px}
  .f-debt,.f-goal{border:1px solid rgba(148,163,184,.1);border-radius:13px;padding:11px;background:rgba(15,23,42,.45)}
  .f-debt-head,.f-goal-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
  .f-debt-name,.f-goal-name{font-size:12px;font-weight:900}
  .f-mini{font-size:9px;color:#8196ab;margin-top:4px}
  .f-ai{border:1px solid rgba(99,102,241,.22);background:linear-gradient(145deg,rgba(49,46,129,.18),rgba(14,116,144,.12));border-radius:23px;padding:16px;position:sticky;top:12px}
  .f-ai-head{display:flex;align-items:center;gap:10px}
  .f-ai-mark{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#6366f1,#06b6d4)}
  .f-ai-title{font-size:16px;font-weight:950}
  .f-ai-copy{font-size:11px;color:#9fb3c7;line-height:1.5;margin:10px 0}
  .f-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .f-chip{border:1px solid rgba(165,180,252,.16);background:rgba(30,41,59,.48);color:#c7d2fe;border-radius:999px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}
  .f-ai-input{width:100%;min-height:90px;resize:vertical;border:1px solid rgba(129,140,248,.22);background:#0a1422;color:#f8fafc;border-radius:13px;padding:11px;outline:none}
  .f-ai-btn{width:100%;border:0;border-radius:12px;padding:11px;margin-top:8px;background:linear-gradient(145deg,#6366f1,#0891b2);color:white;font-weight:900;cursor:pointer}
  .f-ai-btn:disabled{opacity:.45}
  .f-ai-answer{margin-top:10px;border:1px solid rgba(148,163,184,.11);background:rgba(2,6,23,.35);border-radius:12px;padding:11px;font-size:11px;line-height:1.55;color:#d9e7ee;white-space:pre-wrap}
  .f-setup{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .f-label{font-size:9px;color:#73879b;font-weight:800;margin:0 0 5px 2px}
  .f-empty{padding:14px;text-align:center;border:1px dashed rgba(148,163,184,.15);border-radius:12px;color:#708398;font-size:10px}
  .f-strategy{display:flex;gap:6px;margin-left:auto}
  .f-strategy button{border:1px solid rgba(148,163,184,.13);background:#0b1523;color:#8fa3b8;border-radius:9px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}
  .f-strategy .active{color:#6ee7b7;border-color:rgba(52,211,153,.25);background:rgba(16,185,129,.07)}
  @media(max-width:1000px){.f-grid{grid-template-columns:1fr}.f-ai{position:static}.f-cards{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.f-root{padding:10px 9px 105px}.f-title{font-size:20px}.f-secure{display:none}.f-hero{padding:14px}.f-net{font-size:30px}.f-score{width:76px;height:76px}.f-cards{grid-template-columns:1fr 1fr}.f-form{grid-template-columns:1fr 1fr}.f-form .wide{grid-column:span 2}.f-add{min-height:42px}.f-row{grid-template-columns:1fr auto}.f-row .hide-mobile{display:none}.f-budget-row{grid-template-columns:105px 1fr}.f-budget-values{grid-column:2}.f-setup{grid-template-columns:1fr 1fr}}
`;

export default function FinanceCopilotPage() {
  const router = useRouter();
  const [state, setState] = useState<FinanceState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [txMerchant, setTxMerchant] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Food");
  const [txType, setTxType] = useState<"expense" | "income">("expense");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...DEFAULT_STATE, ...JSON.parse(saved) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthTransactions = useMemo(
    () => state.transactions.filter(t => t.date.slice(0, 7) === monthKey),
    [state.transactions, monthKey]
  );
  const monthExpenses = monthTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthIncomeTx = monthTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const income = state.monthlyIncome + monthIncomeTx;
  const freeCash = income - monthExpenses;
  const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0) + state.mortgageBalance;
  const netWorth = state.cashBalance + state.investmentBalance + state.propertyValue - totalDebt;
  const totalMinimums = state.debts.reduce((s, d) => s + d.minimum, 0);
  const savingsRate = income > 0 ? pct((freeCash / income) * 100) : 0;
  const emergencyProgress = state.emergencyTarget > 0 ? pct((state.cashBalance / state.emergencyTarget) * 100) : 0;
  const budgetConfigured = state.budgets.filter(b => b.monthlyLimit > 0);
  const budgetSpend = Object.fromEntries(
    state.budgets.map(b => [
      b.category,
      monthTransactions
        .filter(t => t.type === "expense" && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0),
    ])
  );
  const overBudgetCount = budgetConfigured.filter(b => budgetSpend[b.category] > b.monthlyLimit).length;
  const financeScore = Math.round(
    Math.min(100, Math.max(0,
      35 +
      Math.min(25, savingsRate * 1.1) +
      Math.min(20, emergencyProgress * .2) +
      (overBudgetCount === 0 ? 10 : Math.max(0, 10 - overBudgetCount * 3)) +
      (income > 0 && totalMinimums / income < .2 ? 10 : 3)
    ))
  );

  const rankedDebts = useMemo(() => {
    return [...state.debts].sort((a, b) =>
      strategy === "avalanche"
        ? b.apr - a.apr || a.balance - b.balance
        : a.balance - b.balance || b.apr - a.apr
    );
  }, [state.debts, strategy]);

  function setNumber<K extends keyof FinanceState>(key: K, value: string) {
    setState(current => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  }

  function addTransaction(e: FormEvent) {
    e.preventDefault();
    const amount = Number(txAmount);
    if (!txMerchant.trim() || !amount || amount <= 0) return;
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      merchant: txMerchant.trim(),
      category: txCategory,
      amount,
      type: txType,
    };
    setState(current => ({ ...current, transactions: [transaction, ...current.transactions].slice(0, 250) }));
    setTxMerchant("");
    setTxAmount("");
  }

  function updateBudget(category: string, value: string) {
    setState(current => ({
      ...current,
      budgets: current.budgets.map(b =>
        b.category === category ? { ...b, monthlyLimit: Math.max(0, Number(value) || 0) } : b
      ),
    }));
  }

  function addDebt() {
    setState(current => ({
      ...current,
      debts: [...current.debts, { id: crypto.randomUUID(), name: "New debt", balance: 0, apr: 0, minimum: 0 }],
    }));
  }

  function updateDebt(id: string, field: keyof Debt, value: string) {
    setState(current => ({
      ...current,
      debts: current.debts.map(d =>
        d.id === id ? { ...d, [field]: field === "name" ? value : Math.max(0, Number(value) || 0) } : d
      ),
    }));
  }

  function addGoal() {
    setState(current => ({
      ...current,
      goals: [...current.goals, { id: crypto.randomUUID(), name: "New goal", target: 0, saved: 0, targetDate: "" }],
    }));
  }

  function updateGoal(id: string, field: keyof Goal, value: string) {
    setState(current => ({
      ...current,
      goals: current.goals.map(g =>
        g.id === id
          ? { ...g, [field]: field === "name" || field === "targetDate" ? value : Math.max(0, Number(value) || 0) }
          : g
      ),
    }));
  }

  async function askAI(questionOverride?: string) {
    const question = (questionOverride ?? aiQuestion).trim();
    if (!question || aiLoading) return;
    setAiQuestion(question);
    setAiLoading(true);
    setAiAnswer("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");
      const snapshot = {
        monthlyIncome: income,
        monthlyExpenses: monthExpenses,
        freeCashFlow: freeCash,
        cashBalance: state.cashBalance,
        investments: state.investmentBalance,
        propertyValue: state.propertyValue,
        mortgageBalance: state.mortgageBalance,
        nonMortgageDebt: state.debts,
        monthlyDebtMinimums: totalMinimums,
        netWorth,
        savingsRate,
        emergencyTarget: state.emergencyTarget,
        emergencyProgress,
        budgets: state.budgets.map(b => ({ ...b, spent: budgetSpend[b.category] || 0 })),
        goals: state.goals,
        recentTransactions: state.transactions.slice(0, 40),
        preferredDebtStrategy: strategy,
      };
      const response = await fetch("/api/finance-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({ question, snapshot }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "AI request failed.");
      setAiAnswer(result.answer);
    } catch (error: any) {
      setAiAnswer(error?.message || "AI request failed.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="f-root">
        <div className="f-wrap">
          <div className="f-top">
            <button className="f-back" onClick={() => router.push("/")}>← Dashboard</button>
            <div className="f-brand">
              <div className="f-logo"><WalletCards size={22} /></div>
              <div>
                <div className="f-title">MoneyOS AI</div>
                <div className="f-sub">Your personal financial command center</div>
              </div>
            </div>
            <div className="f-secure"><ShieldCheck size={14}/> PRIVATE BY DEFAULT</div>
          </div>

          <div className="f-grid">
            <div className="f-left">
              <section className="f-hero">
                <div className="f-hero-head">
                  <div>
                    <div className="f-eyebrow">Financial picture</div>
                    <div className="f-net">{money(netWorth)}</div>
                    <div className="f-muted">Estimated net worth from the balances you enter.</div>
                  </div>
                  <div className="f-score" style={{ ["--score" as any]: financeScore + "%" }}>
                    <strong>{financeScore}</strong><span>MONEY SCORE</span>
                  </div>
                </div>
                <div className="f-cards">
                  <div className="f-stat"><div className="f-stat-top"><span>Income this month</span><ArrowUpRight size={14}/></div><strong>{money(income)}</strong></div>
                  <div className="f-stat"><div className="f-stat-top"><span>Spent this month</span><ArrowDownRight size={14}/></div><strong>{money(monthExpenses)}</strong></div>
                  <div className="f-stat"><div className="f-stat-top"><span>Free cash flow</span><TrendingUp size={14}/></div><strong className={freeCash >= 0 ? "f-positive" : "f-negative"}>{money(freeCash)}</strong></div>
                  <div className="f-stat"><div className="f-stat-top"><span>Total debt</span><CreditCard size={14}/></div><strong>{money(totalDebt)}</strong></div>
                </div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head">
                  <div className="f-icon"><Landmark size={18}/></div>
                  <div><div className="f-panel-title">Financial setup</div><div className="f-panel-sub">Edit anytime. Values save automatically on this device.</div></div>
                </div>
                <div className="f-setup">
                  {[
                    ["Monthly base income","monthlyIncome",state.monthlyIncome],
                    ["Cash / checking / savings","cashBalance",state.cashBalance],
                    ["Investments","investmentBalance",state.investmentBalance],
                    ["Property value","propertyValue",state.propertyValue],
                    ["Mortgage balance","mortgageBalance",state.mortgageBalance],
                    ["Emergency fund target","emergencyTarget",state.emergencyTarget],
                  ].map(([label,key,value]) => (
                    <div key={String(key)}>
                      <div className="f-label">{label}</div>
                      <input className="f-input" inputMode="decimal" value={Number(value) || ""} placeholder="$0" onChange={e => setNumber(key as keyof FinanceState,e.target.value)} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head">
                  <div className="f-icon"><ReceiptText size={18}/></div>
                  <div><div className="f-panel-title">Transactions</div><div className="f-panel-sub">Fast manual capture now; bank sync can be added next.</div></div>
                </div>
                <form className="f-form" onSubmit={addTransaction}>
                  <input className="f-input wide" placeholder="Merchant or income source" value={txMerchant} onChange={e=>setTxMerchant(e.target.value)} />
                  <input className="f-input" inputMode="decimal" placeholder="Amount" value={txAmount} onChange={e=>setTxAmount(e.target.value)} />
                  <select className="f-select" value={txCategory} onChange={e=>setTxCategory(e.target.value)}>
                    {state.budgets.map(b=><option key={b.category}>{b.category}</option>)}
                    <option>Income</option><option>Debt Payment</option><option>Other</option>
                  </select>
                  <select className="f-select" value={txType} onChange={e=>setTxType(e.target.value as any)}>
                    <option value="expense">Expense</option><option value="income">Income</option>
                  </select>
                  <button className="f-add" type="submit"><Plus size={17}/></button>
                </form>
                <div className="f-table">
                  {state.transactions.length === 0 ? <div className="f-empty">Add your first transaction to start seeing spending patterns.</div> :
                    state.transactions.slice(0,8).map(t => (
                      <div className="f-row" key={t.id}>
                        <div><strong>{t.merchant}</strong><br/><span>{t.date}</span></div>
                        <span className="hide-mobile">{t.category}</span>
                        <span className="hide-mobile">{t.type === "income" ? "Income" : "Expense"}</span>
                        <span className={"f-amount " + (t.type === "income" ? "f-positive" : "")}>{t.type === "income" ? "+" : "-"}{money(t.amount)}</span>
                      </div>
                    ))
                  }
                </div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head">
                  <div className="f-icon"><CircleDollarSign size={18}/></div>
                  <div><div className="f-panel-title">Smart budget</div><div className="f-panel-sub">Set monthly limits and see progress instantly.</div></div>
                </div>
                <div className="f-budget">
                  {state.budgets.map(b => {
                    const spent = budgetSpend[b.category] || 0;
                    const progress = b.monthlyLimit > 0 ? pct((spent / b.monthlyLimit) * 100) : 0;
                    return <div className="f-budget-row" key={b.category}>
                      <div className="f-budget-name">{b.category}</div>
                      <div className="f-track"><div className="f-fill" style={{width: progress+"%"}} /></div>
                      <div className="f-budget-values">{money(spent)} / <input aria-label={b.category+" budget"} style={{width:62}} className="f-input" value={b.monthlyLimit || ""} placeholder="0" onChange={e=>updateBudget(b.category,e.target.value)} /></div>
                    </div>
                  })}
                </div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head">
                  <div className="f-icon"><CreditCard size={18}/></div>
                  <div><div className="f-panel-title">Debt destroyer</div><div className="f-panel-sub">Rank payoff order automatically.</div></div>
                  <div className="f-strategy">
                    <button className={strategy==="avalanche"?"active":""} onClick={()=>setStrategy("avalanche")}>Avalanche</button>
                    <button className={strategy==="snowball"?"active":""} onClick={()=>setStrategy("snowball")}>Snowball</button>
                  </div>
                  <button className="f-action" onClick={addDebt}>+ Debt</button>
                </div>
                <div className="f-debt-list">
                  {rankedDebts.length === 0 ? <div className="f-empty">Add debts to get an optimized payoff order.</div> :
                    rankedDebts.map((d,index)=>(
                      <div className="f-debt" key={d.id}>
                        <div className="f-debt-head">
                          <div><div className="f-debt-name">#{index+1} <input className="f-input" style={{width:140}} value={d.name} onChange={e=>updateDebt(d.id,"name",e.target.value)} /></div><div className="f-mini">{strategy==="avalanche" ? "Higher APR first" : "Smaller balance first"}</div></div>
                          <ChevronRight size={16}/>
                        </div>
                        <div className="f-setup" style={{marginTop:8}}>
                          <div><div className="f-label">Balance</div><input className="f-input" value={d.balance||""} placeholder="0" onChange={e=>updateDebt(d.id,"balance",e.target.value)}/></div>
                          <div><div className="f-label">APR %</div><input className="f-input" value={d.apr||""} placeholder="0" onChange={e=>updateDebt(d.id,"apr",e.target.value)}/></div>
                          <div><div className="f-label">Minimum</div><input className="f-input" value={d.minimum||""} placeholder="0" onChange={e=>updateDebt(d.id,"minimum",e.target.value)}/></div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head">
                  <div className="f-icon"><Target size={18}/></div>
                  <div><div className="f-panel-title">Goals</div><div className="f-panel-sub">Track savings goals and deadlines.</div></div>
                  <button className="f-action" onClick={addGoal}>+ Goal</button>
                </div>
                <div className="f-goal-list">
                  {state.goals.length===0 ? <div className="f-empty">Add a goal such as emergency fund, vacation, wedding, home project, or payoff target.</div> :
                    state.goals.map(g=>{
                      const progress=g.target>0?pct((g.saved/g.target)*100):0;
                      return <div className="f-goal" key={g.id}>
                        <div className="f-goal-head">
                          <input className="f-input" style={{maxWidth:180}} value={g.name} onChange={e=>updateGoal(g.id,"name",e.target.value)}/>
                          <strong>{Math.round(progress)}%</strong>
                        </div>
                        <div className="f-track" style={{margin:"9px 0"}}><div className="f-fill" style={{width:progress+"%"}}/></div>
                        <div className="f-setup">
                          <div><div className="f-label">Saved</div><input className="f-input" value={g.saved||""} onChange={e=>updateGoal(g.id,"saved",e.target.value)}/></div>
                          <div><div className="f-label">Target</div><input className="f-input" value={g.target||""} onChange={e=>updateGoal(g.id,"target",e.target.value)}/></div>
                          <div><div className="f-label">Target date</div><input className="f-input" type="date" value={g.targetDate} onChange={e=>updateGoal(g.id,"targetDate",e.target.value)}/></div>
                        </div>
                      </div>
                    })
                  }
                </div>
              </section>
            </div>

            <aside className="f-right">
              <section className="f-ai">
                <div className="f-ai-head">
                  <div className="f-ai-mark"><Bot size={20}/></div>
                  <div><div className="f-ai-title">AI Money Copilot</div><div className="f-panel-sub">Read-only analysis of your dashboard</div></div>
                  <Sparkles size={16} style={{marginLeft:"auto"}}/>
                </div>
                <div className="f-ai-copy">Ask anything about your money. The AI receives only the finance snapshot needed to answer and cannot silently edit balances or transactions.</div>
                <div className="f-chips">
                  {["What should I focus on first?","Can I afford a $500 purchase?","Which debt should I pay next?","Where am I overspending?","Build me a 90-day plan"].map(q=>
                    <button key={q} className="f-chip" onClick={()=>void askAI(q)}>{q}</button>
                  )}
                </div>
                <textarea className="f-ai-input" value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} placeholder="Ask your financial copilot..." />
                <button className="f-ai-btn" disabled={aiLoading || !aiQuestion.trim()} onClick={()=>void askAI()}>{aiLoading ? "Analyzing..." : "Analyze my finances"}</button>
                {aiAnswer && <div className="f-ai-answer">{aiAnswer}</div>}
              </section>

              <section className="f-panel">
                <div className="f-panel-head"><div className="f-icon"><PiggyBank size={18}/></div><div><div className="f-panel-title">Emergency fund</div><div className="f-panel-sub">{Math.round(emergencyProgress)}% funded</div></div></div>
                <div className="f-track"><div className="f-fill" style={{width:emergencyProgress+"%"}}/></div>
                <div className="f-muted" style={{marginTop:8}}>{money(state.cashBalance)} saved toward {money(state.emergencyTarget)} target.</div>
              </section>

              <section className="f-panel">
                <div className="f-panel-head"><div className="f-icon"><CalendarDays size={18}/></div><div><div className="f-panel-title">This month</div><div className="f-panel-sub">At-a-glance pressure points</div></div></div>
                <div className="f-table">
                  <div className="f-row"><strong>Savings rate</strong><span className="hide-mobile"></span><span className="hide-mobile"></span><span className="f-amount">{Math.round(savingsRate)}%</span></div>
                  <div className="f-row"><strong>Debt minimums</strong><span className="hide-mobile"></span><span className="hide-mobile"></span><span className="f-amount">{money(totalMinimums)}</span></div>
                  <div className="f-row"><strong>Budgets over limit</strong><span className="hide-mobile"></span><span className="hide-mobile"></span><span className="f-amount">{overBudgetCount}</span></div>
                  <div className="f-row"><strong>Goals</strong><span className="hide-mobile"></span><span className="hide-mobile"></span><span className="f-amount">{state.goals.length}</span></div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
