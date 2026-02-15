import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Pull ALL locations (master list), even if they have zero inventory rows
    const { data, error } = await supabase
      .from("locations")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Many parts of your app probably expect "storageAreas"
    const storageAreas = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
    }));

    return NextResponse.json({ ok: true, storageAreas });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
