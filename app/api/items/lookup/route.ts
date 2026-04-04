import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
 
type Body = {
  query?: string;
  mode?: "BARCODE" | "REF" | "NAME";
  suggest?: boolean;
  barcode?: string;
};
 
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
 
function clean(raw: string) {
  // Strip ALL whitespace including \r \n \t that scanners sometimes append
  return raw.trim().replace(/[\r\n\t]/g, "");
}
 
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const q = clean(body.query ?? body.barcode ?? "");
    const mode = body.mode ?? "BARCODE";
    const suggest = !!body.suggest;
 
    if (!q) {
      return NextResponse.json({ ok: false, error: "Missing query" });
    }
 
    const supabase = getServiceClient();
 
    // Added order_status and backordered so mapItemRow gets the real values
    const selectCols =
      "id,name,barcode,reference_number,unit,order_status,backordered";
 
    // ── BARCODE MODE ──────────────────────────────────────────────────────────
    if (mode === "BARCODE") {
      // 1st attempt: exact match (fastest)
      const { data: exact, error: e1 } = await supabase
        .from("items")
        .select(selectCols)
        .eq("barcode", q)
        .limit(1)
        .maybeSingle();
 
      if (e1) return NextResponse.json({ ok: false, error: e1.message });
      if (exact) return NextResponse.json({ ok: true, item: exact });
 
      // 2nd attempt: case-insensitive match
      // Handles scanners that lowercase or uppercase the code
      const { data: ilike, error: e2 } = await supabase
        .from("items")
        .select(selectCols)
        .ilike("barcode", q)
        .limit(1)
        .maybeSingle();
 
      if (e2) return NextResponse.json({ ok: false, error: e2.message });
      if (ilike) return NextResponse.json({ ok: true, item: ilike });
 
      // 3rd attempt: strip dashes/spaces and try again
      // Handles scanners that drop separators (ASC3627AB2E75 vs ASC-3627AB2E75)
      const qStripped = q.replace(/[-\s]/g, "");
      if (qStripped !== q) {
        const { data: stripped, error: e3 } = await supabase
          .from("items")
          .select(selectCols)
          .ilike("barcode", `%${qStripped}%`)
          .limit(1)
          .maybeSingle();
 
        if (e3) return NextResponse.json({ ok: false, error: e3.message });
        if (stripped) return NextResponse.json({ ok: true, item: stripped });
      }
 
      // Nothing found — fall through to name search as last resort
      // so the user sees suggestions instead of a dead "NOT FOUND"
      const { data: nameFallback, error: e4 } = await supabase
        .from("items")
        .select(selectCols)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(8);
 
      if (e4) return NextResponse.json({ ok: false, error: e4.message });
 
      if (nameFallback && nameFallback.length > 0) {
        return NextResponse.json({
          ok: true,
          item: null,
          matches: nameFallback,
        });
      }
 
      // Truly not found
      return NextResponse.json({ ok: true, item: null, matches: [] });
    }
 
    // ── REF MODE ──────────────────────────────────────────────────────────────
    if (mode === "REF") {
      const { data, error } = await supabase
        .from("items")
        .select(selectCols)
        .eq("reference_number", q)
        .limit(1)
        .maybeSingle();
 
      if (error) return NextResponse.json({ ok: false, error: error.message });
      if (data) return NextResponse.json({ ok: true, item: data });
 
      // Case-insensitive fallback
      const { data: ilikeRef, error: e2 } = await supabase
        .from("items")
        .select(selectCols)
        .ilike("reference_number", q)
        .limit(1)
        .maybeSingle();
 
      if (e2) return NextResponse.json({ ok: false, error: e2.message });
      if (ilikeRef) return NextResponse.json({ ok: true, item: ilikeRef });
    }
 
    // ── NAME MODE ─────────────────────────────────────────────────────────────
    if (mode === "NAME" || suggest) {
      const { data, error } = await supabase
        .from("items")
        .select(selectCols)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(8);
 
      if (error) return NextResponse.json({ ok: false, error: error.message });
 
      const rows = data ?? [];
      if (!suggest && rows.length === 1) {
        return NextResponse.json({ ok: true, item: rows[0] });
      }
      return NextResponse.json({ ok: true, item: null, matches: rows });
    }
 
    // ── FALLBACK: try barcode OR ref exact, then name ilike ───────────────────
    const { data: exact2, error: e5 } = await supabase
      .from("items")
      .select(selectCols)
      .or(`barcode.eq.${q},reference_number.eq.${q}`)
      .limit(1)
      .maybeSingle();
 
    if (e5) return NextResponse.json({ ok: false, error: e5.message });
    if (exact2) return NextResponse.json({ ok: true, item: exact2 });
 
    const { data: like, error: e6 } = await supabase
      .from("items")
      .select(selectCols)
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(8);
 
    if (e6) return NextResponse.json({ ok: false, error: e6.message });
 
    return NextResponse.json({ ok: true, item: null, matches: like ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
