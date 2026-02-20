import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("storage_areas")
      .select("id,name,active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ /api/locations:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      { ok: true, locations: data ?? [], count: (data ?? []).length },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (e: any) {
    console.error("❌ /api/locations crash:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}
