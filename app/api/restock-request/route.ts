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

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("restock_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, resolved_by } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" });

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("restock_requests")
      .update({
        status: "RESTOCKED",
        resolved_at: new Date().toISOString(),
        resolved_by: resolved_by || "Admin",
      })
      .eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}

export async function POST(req: Request) {
  try {
    const { item_id, item_name, requested_by, requested_from } = await req.json();
    if (!item_name || !requested_by) {
      return NextResponse.json({ ok: false, error: "Missing item_name or requested_by" });
    }

    const supabase = getServiceClient();
    const { error } = await supabase.from("restock_requests").insert({
      item_id: item_id || null,
      item_name,
      requested_by,
      requested_from: requested_from || "Pre-Op/PACU",
      status: "PENDING",
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
