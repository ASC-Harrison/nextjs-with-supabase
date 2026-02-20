import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    // sanity check env (won’t reveal keys, just if missing)
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { data, error } = await supabaseAdmin
      .from("storage_areas")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ locations error:", error);
      return NextResponse.json(
        { ok: false, where: "supabase", hasUrl, hasService, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      hasUrl,
      hasService,
      count: (data ?? []).length,
      locations: data ?? [],
    });
  } catch (e: any) {
    console.error("❌ locations crash:", e);
    return NextResponse.json(
      { ok: false, where: "crash", error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
