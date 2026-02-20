import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  };

  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    const { data, error } = await supabaseAdmin
      .from("storage_areas")
      .select("id,name,active")
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ /api/locations:", error);
      return NextResponse.json(
        { ok: false, where: "supabase", error: error.message, supaUrl },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        supaUrl,
        count: (data ?? []).length,
        sample: (data ?? []).slice(0, 5),
        locations: data ?? [],
      },
      { headers }
    );
  } catch (e: any) {
    console.error("❌ /api/locations crash:", e);
    return NextResponse.json(
      { ok: false, where: "crash", error: e?.message ?? "unknown" },
      { status: 500, headers }
    );
  }
}
