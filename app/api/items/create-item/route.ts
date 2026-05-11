import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Item name is required" });

    const supabase = getServiceClient();

    const payload = {
      name: body.name.trim(),
      reference_number: body.reference_number || null,
      item_number: body.item_number || null,
      vendor: body.vendor || null,
      category: body.category || null,
      unit: body.unit || null,
      par_level: body.par_level ?? 0,
      low_level: body.low_level ?? 0,
      price: body.price ?? null,
      supply_source: body.supply_source || "VENDOR",
      notes: body.notes || null,
      expiration_date: body.expiration_date || null,
      is_active: true,
      barcode: `MANUAL-${Date.now()}`,
    };

    const { data, error } = await supabase.from("items").insert(payload).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
