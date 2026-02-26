import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing env for service client");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const { barcode } = (await req.json()) as { barcode?: string };

    const bc = (barcode || "").trim();
    if (!bc) return NextResponse.json({ ok: false, error: "Missing barcode" });

    const supabase = getServiceClient();

    // ✅ match trimmed barcode to avoid space issues
    const { data, error } = await supabase
      .from("items")
      .select("id,name,barcode")
      .ilike("barcode", bc) // case-insensitive exact-ish match for text
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, item: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
