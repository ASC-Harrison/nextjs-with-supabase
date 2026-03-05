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

type Body = {
  storage_area_id: string;
  item_id: string;
  par_level?: number | null;
  on_hand?: number | null;
  shelf?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const storage_area_id = (body.storage_area_id || "").trim();
    const item_id = (body.item_id || "").trim();

    if (!storage_area_id || !item_id) {
      return NextResponse.json(
        { ok: false, error: "storage_area_id and item_id required" },
        { status: 400 }
      );
    }

    const payload: any = { storage_area_id, item_id };

    if (body.par_level !== undefined) payload.par_level = body.par_level;
    if (body.on_hand !== undefined) payload.on_hand = body.on_hand;
    if (body.shelf !== undefined) payload.shelf = body.shelf;

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("storage_inventory")
      .upsert(payload, { onConflict: "storage_area_id,item_id" })
      .select("storage_area_id,item_id,par_level,on_hand,shelf")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
