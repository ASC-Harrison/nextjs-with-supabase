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
    const { storage_area_id, item_id, on_hand, par_level, low_level } = await req.json();

    if (!storage_area_id || !item_id) {
      return NextResponse.json({ ok: false, error: "storage_area_id and item_id are required" });
    }

    const supabase = getServiceClient();

    // Check if row already exists
    const { data: existing } = await supabase
      .from("storage_inventory")
      .select("storage_area_id, item_id")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", item_id)
      .maybeSingle();

    if (existing) {
      // Update existing row
      const { error } = await supabase
        .from("storage_inventory")
        .update({
          on_hand: on_hand ?? 0,
          par_level: par_level ?? 0,
          low_level: low_level ?? 0,
        })
        .eq("storage_area_id", storage_area_id)
        .eq("item_id", item_id);

      if (error) return NextResponse.json({ ok: false, error: error.message });
    } else {
      // Insert new row
      const { error } = await supabase
        .from("storage_inventory")
        .insert({
          storage_area_id,
          item_id,
          on_hand: on_hand ?? 0,
          par_level: par_level ?? 0,
          low_level: low_level ?? 0,
        });

      if (error) return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
