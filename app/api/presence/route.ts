import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const { staff_name, current_area } = await req.json();
    if (!staff_name) return NextResponse.json({ ok: false, error: "Missing staff_name" });

    const supabase = getServiceClient();
    const { error } = await supabase.from("staff_presence").upsert({
      staff_name,
      last_seen: new Date().toISOString(),
      current_area: current_area || "Pre-Op/PACU",
      is_active: true,
    }, { onConflict: "staff_name" });

    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message });
  }
}
