import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";
const MAX_IMAGES = 3;
const MAX_DATA_URL_LENGTH = 1_600_000;

type ExtractedLine = {
  name?: unknown;
  reference_number?: unknown;
  qty?: unknown;
  status?: unknown;
  notes?: unknown;
};

type InventoryItem = {
  id: string;
  name: string | null;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  unit: string | null;
};

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function words(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length > 1));
}

function similarity(a: string, b: string) {
  const aw = words(a);
  const bw = words(b);
  if (!aw.size || !bw.size) return 0;
  let shared = 0;
  for (const word of aw) if (bw.has(word)) shared += 1;
  return shared / Math.max(aw.size, bw.size);
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_DATA_URL_LENGTH) return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function parseJson(text: string) {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced?.[1] || text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const rawImages = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
    const images = rawImages.map(parseDataUrl);
    if (!images.length || images.some(image => !image)) {
      return NextResponse.json({ ok: false, error: "Add at least one clear JPG, PNG, or WebP photo" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const imageBlocks = images.map(image => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: image!.mediaType as "image/jpeg" | "image/png" | "image/webp",
        data: image!.data,
      },
    }));

    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system:
        "You extract surgical preference cards into strict JSON. Never invent text that is not visible. Use null for uncertain header fields. Preserve manufacturer reference numbers exactly. Quantity defaults to 1 only when an item is clearly present but its quantity is blank. Allowed status values are OPEN, HOLD, PRN. Return JSON only.",
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text:
              'Read every supplied page as one preference card. Return {"surgeon":string|null,"procedure_name":string|null,"specialty":string|null,"notes":string|null,"items":[{"name":string,"reference_number":string|null,"qty":number,"status":"OPEN"|"HOLD"|"PRN","notes":string|null}]}. Do not combine distinct line items.',
          },
        ],
      }],
    });

    const textBlock = completion.content.find(block => block.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no readable card data");
    const extracted = parseJson(textBlock.text);
    const extractedLines: ExtractedLine[] = Array.isArray(extracted?.items) ? extracted.items.slice(0, 250) : [];

    const { data: itemRows, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id,name,reference_number,vendor,category,unit")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (itemError) throw itemError;
    const inventory = (itemRows || []) as InventoryItem[];

    const matched = extractedLines.map((line, index) => {
      const extractedName = clean(line.name);
      const extractedRef = clean(line.reference_number, 100);
      const refNorm = normalize(extractedRef);
      let item: InventoryItem | null = null;
      let confidence: "high" | "medium" | "unmatched" = "unmatched";
      let score = 0;

      if (refNorm) {
        item = inventory.find(candidate => normalize(candidate.reference_number || "") === refNorm) || null;
        if (item) {
          confidence = "high";
          score = 1;
        }
      }

      if (!item && extractedName) {
        const ranked = inventory
          .map(candidate => ({ candidate, score: similarity(extractedName, candidate.name || "") }))
          .sort((a, b) => b.score - a.score);
        if (ranked[0]?.score >= 0.72) {
          item = ranked[0].candidate;
          score = ranked[0].score;
          confidence = score >= 0.9 ? "high" : "medium";
        }
      }

      const numericQty = Number(line.qty);
      const status = ["OPEN", "HOLD", "PRN"].includes(String(line.status).toUpperCase())
        ? String(line.status).toUpperCase()
        : "OPEN";

      return {
        row_id: String(index + 1),
        extracted_name: extractedName || "Unreadable item",
        extracted_reference: extractedRef || null,
        qty: Number.isFinite(numericQty) && numericQty >= 0 ? numericQty : 1,
        status,
        notes: clean(line.notes, 500) || null,
        match: item ? {
          id: item.id,
          name: item.name || "Unnamed item",
          reference_number: item.reference_number,
          vendor: item.vendor,
          category: item.category,
          unit: item.unit,
        } : null,
        confidence,
        score: Math.round(score * 100),
      };
    });

    return NextResponse.json({
      ok: true,
      draft: {
        surgeon: clean(extracted?.surgeon) || "",
        procedure_name: clean(extracted?.procedure_name) || "",
        specialty: clean(extracted?.specialty) || "",
        notes: clean(extracted?.notes, 1000) || "",
        items: matched,
      },
      safety: "Draft only. No preference card or inventory quantity has been changed.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Preference card scan failed";
    console.error("pref-card-scan", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
