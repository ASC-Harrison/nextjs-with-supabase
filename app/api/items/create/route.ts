import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing env for service client");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      barcode?: string;
      storage_area_id?: string;
      par_level?: number;
    };

    const name = (body.name || "").trim();
    const barcode = (body.barcode || "").trim();
    const storage_area_id = (body.storage_area_id || "").trim();
    const par_level = Number(body.par_level ?? 0);

    if (!name) return NextResponse.json({ ok: false, error: "Missing name" });
    if (!barcode) return NextResponse.json({ ok: false, error: "Missing barcode" });
    if (!storage_area_id)
      return NextResponse.json({ ok: false, error: "Missing storage_area_id" });
    if (!Number.isFinite(par_level) || par_level < 0)
      return NextResponse.json({ ok: false, error: "par_level must be >= 0" });

    const supabase = getServiceClient();

    // 1) Create the item (global PAR stored in items.par_level)
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .insert({
        name,
        barcode,
        par_level: Math.trunc(par_level),
      })
      .select("id,name,barcode")
      .single();

    if (itemErr) throw itemErr;

    // 2) Ensure storage_inventory row exists for this location (per-location PAR too)
    const { error: invErr } = await supabase.from("storage_inventory").upsert(
      {
        storage_area_id,
        item_id: item.id,
        on_hand: 0,
        par_level: Math.trunc(par_level),
      },
      { onConflict: "storage_area_id,item_id" }
    );

    if (invErr) throw invErr;

    // 3) Ensure building totals row exists
    await supabase
      .from("building_inventory")
      .upsert({ item_id: item.id, total_on_hand: 0 }, { onConflict: "item_id" });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
