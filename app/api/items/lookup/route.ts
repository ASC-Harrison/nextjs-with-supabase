export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { barcode } = await req.json();

  if (!barcode) return NextResponse.json({ ok: false, error: "Missing barcode" }, { status: 400, headers });

  const { data, error } = await supabaseAdmin
    .from("items")
    .select("id,name,barcode")
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });

  return NextResponse.json({ ok: true, item: data ?? null }, { headers });
}
