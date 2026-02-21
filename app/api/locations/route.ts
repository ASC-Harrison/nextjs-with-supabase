import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("storage_areas")
      .select("id,name,active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true, locations: data ?? [] }, { headers });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500, headers }
    );
  }
}
