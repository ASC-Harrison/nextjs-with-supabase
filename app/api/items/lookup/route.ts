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
  return raw.trim();
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

    // IMPORTANT: unit is included so Transaction can detect Bx / Box
    const selectCols = "id,name,barcode,reference_number,unit";

    if (mode === "BARCODE") {
      const { data, error } = await supabase
        .from("items")
        .select(selectCols)
        .eq("barcode", q)
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      if (data) {
        return NextResponse.json({ ok: true, item: data });
      }
    }

    if (mode === "REF") {
      const { data, error } = await supabase
        .from("items")
        .select(selectCols)
        .eq("reference_number", q)
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      if (data) {
        return NextResponse.json({ ok: true, item: data });
      }
    }

    if (mode === "NAME" || suggest) {
      const { data, error } = await supabase
        .from("items")
        .select(selectCols)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(8);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      const rows = data ?? [];

      if (!suggest && rows.length === 1) {
        return NextResponse.json({ ok: true, item: rows[0] });
      }

      return NextResponse.json({ ok: true, item: null, matches: rows });
    }

    const { data: exact2, error: e2 } = await supabase
      .from("items")
      .select(selectCols)
      .or(`barcode.eq.${q},reference_number.eq.${q}`)
      .limit(1)
      .maybeSingle();

    if (e2) {
      return NextResponse.json({ ok: false, error: e2.message });
    }

    if (exact2) {
      return NextResponse.json({ ok: true, item: exact2 });
    }

    const { data: like, error: e3 } = await supabase
      .from("items")
      .select(selectCols)
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(8);

    if (e3) {
      return NextResponse.json({ ok: false, error: e3.message });
    }

    return NextResponse.json({ ok: true, item: null, matches: like ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
