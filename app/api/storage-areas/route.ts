// app/api/locations/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type LocationRow = { id: string; name: string };

async function loadFromTable(table: "locations" | "storage_areas") {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(table)
    .select("id,name")
    .order("name", { ascending: true });

  if (error) return { ok: false as const, error, data: null };
  return { ok: true as const, data: (data ?? []) as LocationRow[] };
}

export async function GET() {
  try {
    // Try "locations" first (you clearly have this table)
    const a = await loadFromTable("locations");
    if (a.ok) {
      return NextResponse.json({ ok: true, locations: a.data });
    }

    // Fallback to older naming
    const b = await loadFromTable("storage_areas");
    if (b.ok) {
      return NextResponse.json({ ok: true, locations: b.data });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load locations from locations or storage_areas.",
        details: String(a.error?.message ?? "unknown"),
      },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
