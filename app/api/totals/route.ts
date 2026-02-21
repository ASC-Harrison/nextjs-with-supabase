export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  // Pull inventory with joins
  const { data, error } = await supabaseAdmin
    .from("storage_inventory")
    .select(`
      area_id,
      on_hand,
      par_level,
      storage_areas:area_id ( id, name )
    `);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });
  }

  const rows = data ?? [];

  // Build totals
  const perAreaMap = new Map<string, { area_id: string; area_name: string; on_hand_total: number; par_total: number; low_count: number }>();

  let overall_on_hand_total = 0;
  let overall_par_total = 0;
  let overall_low_count = 0;

  for (const r of rows as any[]) {
    const area_id = r.area_id as string;
    const area_name = r.storage_areas?.name ?? "Unknown";
    const on_hand = Number(r.on_hand ?? 0);
    const par = Number(r.par_level ?? 0);
    const low = on_hand < par && par > 0;

    overall_on_hand_total += on_hand;
    overall_par_total += par;
    if (low) overall_low_count += 1;

    const existing = perAreaMap.get(area_id) ?? {
      area_id,
      area_name,
      on_hand_total: 0,
      par_total: 0,
      low_count: 0,
    };

    existing.on_hand_total += on_hand;
    existing.par_total += par;
    if (low) existing.low_count += 1;

    perAreaMap.set(area_id, existing);
  }

  const per_area = Array.from(perAreaMap.values()).sort((a, b) => a.area_name.localeCompare(b.area_name));

  return NextResponse.json(
    {
      ok: true,
      overall: { on_hand_total: overall_on_hand_total, par_total: overall_par_total, low_count: overall_low_count },
      per_area,
    },
    { headers }
  );
}
