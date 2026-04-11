import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Allow requests from anywhere including local HTML files
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Missing message" },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are an AI inventory monitor for Baxter ASC (Ambulatory Surgery Center). You have real-time read-only access to their complete inventory system. Help staff understand stock levels, identify what needs reordering, flag critical shortages, and analyze usage patterns. Be concise and practical. Here is the current live inventory data:\n\n${context || "No inventory data provided."}`,
      messages: [{ role: "user", content: message }],
    });

    return NextResponse.json(
      {
        ok: true,
        text:
          response.content[0].type === "text"
            ? response.content[0].text
            : "",
      },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
