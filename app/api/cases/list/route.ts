import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

export async function GET() {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("cases")
      .select("id,scheduled_at,procedure,surgeon,room,status,created_at,updated_at")
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({ ok: true, cases: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
