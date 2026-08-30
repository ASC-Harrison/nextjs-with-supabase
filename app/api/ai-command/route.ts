import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = ["admin", "staff", "preop"];
const MODEL = "claude-haiku-4-5-20251001";
const STOP_WORDS = new Set([
  "a","about","all","am","an","and","any","are","at","be","can","could","do","for","from","have","how","i","in","is","it","me","my","of","on","or","our","please","show","tell","that","the","them","there","this","to","we","what","when","where","which","with","you",
  "inventory","item","items","stock","amount","number","quantity","qty","received","receive","receiving","order","ordered","price","pricing","cost","change","set","adjust","add","mark","box","boxes"
]);

type InventoryRow = {
  item_id: string;
  name: string;
  reference_number: string | null;
  vendor: string | null;
  category: string | null;
  total_on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
  unit: string | null;
  order_status?: string | null;
  backordered?: boolean | null;
};

type ItemMeta = {
  id: string;
  name: string;
  price: number | null;
  supply_source: string | null;
  expiration_date: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  item_id: string | null;
  item_name: string;
  status: string;
  qty_requested: number | null;
  qty_actual_ordered: number | null;
  qty_actual_received: number | null;
  vendor: string | null;
  expected_delivery_date: string | null;
};

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function cleanTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token) && !/^\d/.test(token));
}

function scoreItem(row: InventoryRow, tokens: string[]) {
  if (!tokens.length) return 0;
  const name = (row.name || "").toLowerCase();
  const ref = (row.reference_number || "").toLowerCase();
  const vendor = (row.vendor || "").toLowerCase();
  const category = (row.category || "").toLowerCase();
  return tokens.reduce((score, token) => {
    if (name === token || ref === token) return score + 8;
    if (name.includes(token)) return score + 5;
    if (ref.includes(token)) return score + 4;
    if (vendor.includes(token) || category.includes(token)) return score + 2;
    return score;
  }, 0);
}

function detectDraft(message: string, matches: InventoryRow[]) {
  const lower = message.toLowerCase();
  const actionLanguage =
    /\b(we\s+received|mark\s+.{0,40}\s+received|receive\s+\d|add\s+\d|adjust\s+.{0,40}\s+to\s+\d|set\s+.{0,40}\s+to\s+\d|change\s+.{0,40}\s+to\s+\d|order\s+\d|update\s+.{0,40}\s+price)\b/i.test(message);
  if (!actionLanguage) return null;

  const quantityMatch = message.match(/(?:received|receive|add|order|ordered|qty|quantity|to)\D{0,18}(\d+(?:\.\d+)?)/i);
  const priceMatch = message.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  const unitPrice = priceMatch ? Number(priceMatch[1]) : null;
  const item = matches[0] || null;

  let type = "ADJUST_INVENTORY";
  let route = "/inventory";
  if (/\breceiv/i.test(lower)) {
    type = "RECEIVE_ORDER";
    route = "/orders";
  } else if (/\bprice|\bcost|\$/.test(lower)) {
    type = "UPDATE_PRICE";
    route = "/price-editor";
  } else if (/\border\b/.test(lower)) {
    type = "CREATE_ORDER";
    route = "/orders";
  }

  const parts = [
    type.replaceAll("_", " ").toLowerCase(),
    item ? item.name : "an item that still needs to be selected",
    quantity !== null ? "quantity " + quantity : null,
    unitPrice !== null ? "at $" + unitPrice.toFixed(2) : null,
  ].filter(Boolean);

  return {
    type,
    item_id: item?.item_id || null,
    item_name: item?.name || null,
    quantity,
    unit_price: unitPrice,
    summary: parts.join(" · "),
    route,
    requires_confirmation: true,
  };
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
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) return NextResponse.json({ ok: false, error: "Staff access required" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ ok: false, error: "Ask the AI a question" }, { status: 400 });
    if (message.length > 800) {
      return NextResponse.json({ ok: false, error: "Questions are limited to 800 characters" }, { status: 400 });
    }

    const [inventoryResult, itemResult, orderResult] = await Promise.all([
      supabaseAdmin
        .from("building_inventory_sheet_view")
        .select("item_id,name,reference_number,vendor,category,total_on_hand,par_level,low_level,unit,order_status,backordered")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("items")
        .select("id,name,price,supply_source,expiration_date")
        .eq("is_active", true),
      supabaseAdmin
        .from("order_requests")
        .select("id,created_at,item_id,item_name,status,qty_requested,qty_actual_ordered,qty_actual_received,vendor,expected_delivery_date")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (inventoryResult.error) throw inventoryResult.error;
    if (itemResult.error) throw itemResult.error;
    if (orderResult.error) throw orderResult.error;

    const inventory = (inventoryResult.data || []) as InventoryRow[];
    const itemMeta = (itemResult.data || []) as ItemMeta[];
    const orders = (orderResult.data || []) as OrderRow[];
    const metaById = new Map(itemMeta.map(item => [item.id, item]));
    const enriched = inventory.map(row => ({
      ...row,
      price: metaById.get(row.item_id)?.price ?? null,
      supply_source: metaById.get(row.item_id)?.supply_source ?? null,
      expiration_date: metaById.get(row.item_id)?.expiration_date ?? null,
    }));

    const low = enriched
      .filter(row => (row.low_level ?? 0) > 0 && (row.total_on_hand ?? 0) <= (row.low_level ?? 0))
      .sort((a, b) => ((a.total_on_hand ?? 0) - (a.low_level ?? 0)) - ((b.total_on_hand ?? 0) - (b.low_level ?? 0)));
    const out = low.filter(row => (row.total_on_hand ?? 0) <= 0);
    const activeOrders = orders.filter(order => ["PENDING", "ORDERED", "BACKORDERED", "AWAITING"].includes(order.status));
    const totalUnits = enriched.reduce((sum, row) => sum + (row.total_on_hand ?? 0), 0);

    const lower = message.toLowerCase();
    const tokens = cleanTokens(message);
    const matches = enriched
      .map(row => ({ row, score: scoreItem(row, tokens) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
      .slice(0, 15)
      .map(entry => entry.row);

    const wantsLow = /\b(low|out of stock|attention|need(?:s)? ordered|reorder|below par|shortage)\b/.test(lower);
    const wantsOrders = /\b(order|ordered|backorder|delivery|deliveries|pending|receive|received)\b/.test(lower);
    const wantsPricing = /\b(price|pricing|cost|expensive|vendor)\b|\$/.test(lower);

    const relevantItems = matches.length
      ? matches
      : wantsLow
        ? low.slice(0, 40)
        : wantsPricing
          ? enriched.filter(row => row.price !== null).slice(0, 40)
          : enriched.slice(0, 20);

    const relevantOrders = wantsOrders
      ? activeOrders
          .filter(order => !matches.length || matches.some(item => item.item_id === order.item_id || item.name.toLowerCase() === order.item_name.toLowerCase()))
          .slice(0, 40)
      : [];

    const draft = detectDraft(message, matches);

    const facts = {
      summary: {
        active_items: enriched.length,
        total_units_on_hand: totalUnits,
        low_items: low.length,
        out_of_stock_items: out.length,
        active_orders: activeOrders.length,
      },
      matching_items: relevantItems.map(row => ({
        id: row.item_id,
        name: row.name,
        reference: row.reference_number,
        on_hand: row.total_on_hand ?? 0,
        par: row.par_level ?? 0,
        low: row.low_level ?? 0,
        unit: row.unit,
        vendor: row.vendor,
        category: row.category,
        price: row.price,
        order_status: row.order_status,
        backordered: Boolean(row.backordered),
      })),
      matching_orders: relevantOrders.map(order => ({
        item: order.item_name,
        status: order.status,
        requested: order.qty_requested,
        ordered: order.qty_actual_ordered,
        received: order.qty_actual_received,
        vendor: order.vendor,
        expected: order.expected_delivery_date,
      })),
      action_draft: draft,
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        "You are the protected AI command center for Baxter ASC inventory. Answer using only the supplied live facts. Be concise, specific, and practical. Never invent an item, count, price, status, or date. If matching_items is empty, say you could not find a confident match and ask for the item name or reference number. If action_draft is present, clearly say it is a preview and nothing has been changed. Never claim an action was executed. Do not request or discuss patient-identifying information.",
      messages: [{
        role: "user",
        content: "Staff question:\n" + message + "\n\nLive read-only facts:\n" + JSON.stringify(facts),
      }],
    });

    const answerBlock = completion.content.find(block => block.type === "text");
    const answer = answerBlock?.type === "text" ? answerBlock.text.trim() : "I could not complete that question.";

    return NextResponse.json({
      ok: true,
      answer,
      draft,
      results: {
        items: facts.matching_items.slice(0, 12),
        orders: facts.matching_orders.slice(0, 12),
      },
      safety: "Read-only AI response. No inventory data was changed.",
    });
  } catch (error: any) {
    console.error("AI command failed:", error?.message ?? error);
    return NextResponse.json({ ok: false, error: "The AI command could not be completed safely." }, { status: 500 });
  }
}
