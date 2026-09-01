import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MODEL = "claude-haiku-4-5-20251001";

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const snapshot = body?.snapshot && typeof body.snapshot === "object" ? body.snapshot : null;

    if (!question || !snapshot) {
      return NextResponse.json({ ok: false, error: "Question and finance snapshot are required." }, { status: 400 });
    }
    if (question.length > 1000) {
      return NextResponse.json({ ok: false, error: "Questions are limited to 1,000 characters." }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 650,
      system:
        "You are a careful personal finance copilot. Use only the supplied snapshot. Give practical, prioritized guidance with specific dollar amounts when the data supports it. Never claim to have moved money, paid debt, changed an account, or executed a transaction. Do not invent balances, APRs, income, tax facts, returns, or future outcomes. Clearly identify assumptions. For debt guidance, respect the user's preferred avalanche or snowball strategy. For affordability questions, weigh current free cash flow, debt minimums, emergency fund progress, goals, and budget pressure. Avoid pretending to be a fiduciary, tax professional, attorney, or lender. Keep the answer concise and easy to act on. Plain text only.",
      messages: [{
        role: "user",
        content: "Question:\n" + question + "\n\nCurrent finance snapshot:\n" + JSON.stringify(snapshot),
      }],
    });

    const block = completion.content.find(item => item.type === "text");
    const answer = block?.type === "text" ? block.text.trim() : "I could not complete the analysis.";

    return NextResponse.json({
      ok: true,
      answer,
      safety: "Read-only analysis. No balances, debts, goals, budgets, or transactions were changed.",
    });
  } catch (error: any) {
    console.error("Finance AI failed:", error?.message ?? error);
    return NextResponse.json({ ok: false, error: "The financial analysis could not be completed safely." }, { status: 500 });
  }
}
