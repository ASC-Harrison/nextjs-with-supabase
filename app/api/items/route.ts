import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);
    const query = (url.searchParams.get("query") || "").trim();
    const barcode = (url.searchParams.get("barcode") || "").trim();

    if (barcode) {
      const { data, error } = await supabase
        .from("items")
        .select("id,name,reference_number")
        .eq("reference_number", barcode)
        .maybeSingle();

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, item: data || null });
    }

    if (!query) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data, error } = await supabase
      .from("items")
      .select("id,name,reference_number")
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true })
      .limit(25);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
