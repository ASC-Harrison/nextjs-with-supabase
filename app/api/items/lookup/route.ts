import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Looks up items.reference_number == scanned barcode text
  const { data, error } = await supabase
    .from("items")
    .select("id,name,reference_number")
    .eq("reference_number", code)
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const item = data?.[0];
  if (!item) {
    return NextResponse.json({ ok: true, found: false });
  }

  return NextResponse.json({ ok: true, found: true, item });
}
