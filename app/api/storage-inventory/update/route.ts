import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  storage_area_id: string;
  item_id: string;
  on_hand: number | null;
  par_level: number | null;
  low_level: number | null;
};

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

function cleanNonNegativeInt(val: unknown, field: string) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be 0 or more`);
  }
  return Math.trunc(n);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.storage_area_id || !body?.item_id) {
      return NextResponse.json(
        { ok: false, error: "Missing storage_area_id or item_id" },
        { status: 400 }
      );
    }

    const on_hand = cleanNonNegativeInt(body.on_hand, "on_hand");
    const par_level = cleanNonNegativeInt(body.par_level, "par_level");
    const low_level = cleanNonNegativeInt(body.low_level, "low_level");

    const supabase = getServiceClient();

    const payload = {
      storage_area_id: body.storage_area_id,
      item_id: body.item_id,
      on_hand,
      par_level,
      low_level,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("storage_inventory")
      .upsert(payload, {
        onConflict: "item_id,storage_area_id",
      });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
