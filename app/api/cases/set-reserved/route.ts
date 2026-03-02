import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

type Body = {
  case_line_id: string;
  reserved_qty: number;
  staff?: string;
  device_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const case_line_id = (body.case_line_id || "").trim();
    const reserved_qty = Number(body.reserved_qty);

    const staff = (body.staff || "Unknown").trim() || "Unknown";
    const device_id = (body.device_id || "").trim() || null;

    if (!case_line_id) return NextResponse.json({ ok: false, error: "Missing case_line_id" });
    if (!Number.isFinite(reserved_qty) || reserved_qty < 0) {
      return NextResponse.json({ ok: false, error: "reserved_qty must be 0 or more" });
    }

    const supabase = getServiceClient();

    const { data: line, error: lErr } = await supabase
      .from("case_lines")
      .select("id,case_id,item_id,planned_qty")
      .eq("id", case_line_id)
      .single();

    if (lErr) return NextResponse.json({ ok: false, error: lErr.message });

    // Don’t allow reserved > planned (keeps it sane)
    const planned = Number(line.planned_qty ?? 0);
    const capped = Math.min(reserved_qty, planned);

    const { error: uErr } = await supabase
      .from("case_lines")
      .update({ reserved_qty: capped })
      .eq("id", case_line_id);

    if (uErr) return NextResponse.json({ ok: false, error: uErr.message });

    await supabase.from("case_events").insert({
      case_id: line.case_id,
      staff,
      device_id,
      action: "RESERVED_SET",
      item_id: line.item_id,
      qty: capped,
      details: `Reserved=${capped}/${planned}`,
    });

    return NextResponse.json({ ok: true, reserved_qty: capped });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
