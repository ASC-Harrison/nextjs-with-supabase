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
  on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.storage_area_id || !body?.item_id) {
      return NextResponse.json({ ok: false, error: "Missing ids" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Update the row for this area + item
    const { error } = await supabase
      .from("storage_inventory")
      .update({
        on_hand: body.on_hand,
        par_level: body.par_level,
        low_level: body.low_level,
      })
      .eq("storage_area_id", body.storage_area_id)
      .eq("item_id", body.item_id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
