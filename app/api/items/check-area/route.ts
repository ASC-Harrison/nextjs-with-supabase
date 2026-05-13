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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const item_id = searchParams.get("item_id");
    const storage_area_id = searchParams.get("storage_area_id");

    if (!item_id || !storage_area_id) {
      return NextResponse.json({ ok: false, error: "Missing params" });
    }

    const supabase = getServiceClient();

    const { data } = await supabase
      .from("storage_inventory")
      .select("on_hand, par_level, low_level")
      .eq("item_id", item_id)
      .eq("storage_area_id", storage_area_id)
      .maybeSingle();

    return NextResponse.json({ ok: true, data: data || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message });
  }
}
