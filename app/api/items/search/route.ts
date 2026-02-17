import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const { data, error } = await supabase
    .from("items")
    .select("id,name")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}
