import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

type Body = {
  scheduled_at?: string | null; // ISO or null
  procedure: string;
  surgeon?: string;
  room?: string;
  notes?: string | null;
  staff?: string;
  device_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const procedure = (body.procedure || "").trim();
    if (!procedure) return NextResponse.json({ ok: false, error: "Missing procedure" });

    const scheduled_at = body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
    const surgeon = (body.surgeon || "").trim();
    const room = (body.room || "").trim();
    const notes = (body.notes || null) ? String(body.notes) : null;

    const staff = (body.staff || "Unknown").trim() || "Unknown";
    const device_id = (body.device_id || "").trim() || null;

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("cases")
      .insert({
        scheduled_at,
        procedure,
        surgeon,
        room,
        notes,
        status: "scheduled",
      })
      .select("id,scheduled_at,procedure,surgeon,room,status,created_at,updated_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message });

    await supabase.from("case_events").insert({
      case_id: data.id,
      staff,
      device_id,
      action: "CASE_CREATED",
      details: `Procedure=${procedure}`,
    });

    return NextResponse.json({ ok: true, case: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
