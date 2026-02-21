export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };

  const url = new URL(req.url);
  const area_id = url.searchParams.get("area_id"); // optional

  let q = supabaseAdmin
    .from("storage_inventory")
    .select(
      `
      item_id,
      area_id,
      on_hand,
      par_level,
      low_notified,
      items:item_id ( id, name, barcode ),
      storage_areas:area_id ( id, name )
    `
    )
    .gt("par_level", 0);

  if (area_id) q = q.eq("area_id", area_id);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });
  }

  const rows = (data ?? []).filter((r: any) => Number(r.on_hand ?? 0) < Number(r.par_level ?? 0));

  // Sort most urgent first: lowest % of par
  rows.sort((a: any, b: any) => {
    const ap = Number(a.par_level || 0) || 1;
    const bp = Number(b.par_level || 0) || 1;
    const ar = Number(a.on_hand || 0) / ap;
    const br = Number(b.on_hand || 0) / bp;
    return ar - br;
  });

  return NextResponse.json({ ok: true, rows }, { headers });
}
