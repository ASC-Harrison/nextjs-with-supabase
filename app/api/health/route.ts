import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function mask(key: string | undefined) {
  if (!key) return null;
  if (key.length <= 10) return "**********";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mainSupply = process.env.MAIN_SUPPLY_AREA_ID ?? null;

    // quick DB ping to confirm it can actually read the project
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("storage_areas")
      .select("id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json(
      {
        ok: true,
        env: {
          supabase_url: url ?? null,
          anon_key_masked: mask(anon ?? undefined),
          service_key_masked: mask(service ?? undefined),
          main_supply_area_id: mainSupply,
        },
        db_check: {
          storage_areas_read_ok: true,
          sample_rows_returned: (data?.length ?? 0),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  }
}
