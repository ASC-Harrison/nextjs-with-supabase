import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

type Body = { case_id: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const case_id = (body.case_id || "").trim();
    if (!case_id) return NextResponse.json({ ok: false, error: "Missing case_id" });

    const supabase = getServiceClient();

    const { data: c, error: cErr } = await supabase
      .from("cases")
      .select("id,scheduled_at,procedure,surgeon,room,notes,status,created_at,updated_at")
      .eq("id", case_id)
      .single();

    if (cErr) return NextResponse.json({ ok: false, error: cErr.message });

    const { data: lines, error: lErr } = await supabase
      .from("case_lines_view")
      .select(
        "id,case_id,item_id,item_name,barcode,reference_number,planned_qty,reserved_qty,used_qty,source_area_id,notes,created_at,updated_at"
      )
      .eq("case_id", case_id)
      .order("item_name", { ascending: true });

    if (lErr) return NextResponse.json({ ok: false, error: lErr.message });

    const { data: events, error: eErr } = await supabase
      .from("case_events")
      .select("id,case_id,ts,staff,device_id,action,item_id,qty,details")
      .eq("case_id", case_id)
      .order("ts", { ascending: false })
      .limit(200);

    if (eErr) return NextResponse.json({ ok: false, error: eErr.message });

    return NextResponse.json({ ok: true, case: c, lines: lines ?? [], events: events ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
