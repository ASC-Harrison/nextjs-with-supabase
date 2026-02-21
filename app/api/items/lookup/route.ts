export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { barcode } = await req.json();

  if (!barcode) {
    return NextResponse.json({ ok: false, error: "Missing barcode" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("items")
    .select("id,name,barcode")
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data ?? null });
}
