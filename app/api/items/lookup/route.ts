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

    // 1) Try items.barcode first (your current behavior)
    const { data: directItem, error: directErr } = await supabase
      .from("items")
      .select("id,name,barcode")
      .eq("barcode", bc)
      .maybeSingle();

    if (directErr) throw directErr;
    if (directItem) return NextResponse.json({ ok: true, item: directItem });

    // 2) Fallback: item_barcodes table -> map to items
    const { data: mapRow, error: mapErr } = await supabase
      .from("item_barcodes")
      .select("item_id,barcode")
      .eq("barcode", bc)
      .maybeSingle();

    if (mapErr) throw mapErr;

    if (!mapRow?.item_id) {
      return NextResponse.json({ ok: true, item: null });
    }

    const { data: mappedItem, error: itemErr } = await supabase
      .from("items")
      .select("id,name")
      .eq("id", mapRow.item_id)
      .maybeSingle();

    if (itemErr) throw itemErr;

    if (!mappedItem) return NextResponse.json({ ok: true, item: null });

    return NextResponse.json({
      ok: true,
      item: { ...mappedItem, barcode: bc },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
