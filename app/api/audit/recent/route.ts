import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);

    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const storage_area_id = (searchParams.get("storage_area_id") || "").trim();

    let q = supabase
      .from("audit_events")
      .select("id,ts,staff,device_id,action,storage_area_id,item_id,qty,mode,details")
      .order("ts", { ascending: false })
      .limit(limit);

    if (storage_area_id) q = q.eq("storage_area_id", storage_area_id);

    const { data, error } = await q;

    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({ ok: true, events: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
