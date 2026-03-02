import { NextResponse } from "next/server";
import { getServiceClient } from "../_supabase";

type Body = {
  case_id: string;
  item_id: string;
  planned_qty?: number;
  source_area_id?: string | null;
  notes?: string | null;
  staff?: string;
  device_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const case_id = (body.case_id || "").trim();
    const item_id = (body.item_id || "").trim();
    const planned_qty = Number(body.planned_qty ?? 1);
    const source_area_id = (body.source_area_id || "").trim() || null;
    const notes = body.notes ? String(body.notes) : null;

    const staff = (body.staff || "Unknown").trim() || "Unknown";
    const device_id = (body.device_id || "").trim() || null;

    if (!case_id) return NextResponse.json({ ok: false, error: "Missing case_id" });
    if (!item_id) return NextResponse.json({ ok: false, error: "Missing item_id" });
    if (!Number.isFinite(planned_qty) || planned_qty <= 0) {
      return NextResponse.json({ ok: false, error: "planned_qty must be > 0" });
    }

    const supabase = getServiceClient();

    // Upsert: if line exists for item, increase planned_qty
    const { data: existing } = await supabase
      .from("case_lines")
      .select("id,planned_qty")
      .eq("case_id", case_id)
      .eq("item_id", item_id)
      .maybeSingle();

    if (existing?.id) {
      const { error: uErr } = await supabase
        .from("case_lines")
        .update({
          planned_qty: (existing.planned_qty ?? 0) + planned_qty,
          source_area_id,
          notes,
        })
        .eq("id", existing.id);

      if (uErr) return NextResponse.json({ ok: false, error: uErr.message });

      await supabase.from("case_events").insert({
        case_id,
        staff,
        device_id,
        action: "LINE_ADDED",
        item_id,
        qty: planned_qty,
        details: `Planned+=${planned_qty} (existing line)`,
      });

      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from("case_lines").insert({
      case_id,
      item_id,
      planned_qty,
      reserved_qty: 0,
      used_qty: 0,
      source_area_id,
      notes,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    await supabase.from("case_events").insert({
      case_id,
      staff,
      device_id,
      action: "LINE_ADDED",
      item_id,
      qty: planned_qty,
      details: `Planned=${planned_qty}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
