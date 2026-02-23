import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  storage_area_id?: string; // normal
  mode: "USE" | "RESTOCK";
  item_id: string;
  qty: number;
  mainOverride?: boolean; // if true, use MAIN_SUPPLY_AREA_ID
};

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
    const body = (await req.json()) as Body;

    const qty = Math.trunc(Number(body.qty ?? 0));
    if (!body.item_id) return NextResponse.json({ ok: false, error: "Missing item_id" });
    if (!Number.isFinite(qty) || qty <= 0)
      return NextResponse.json({ ok: false, error: "qty must be >= 1" });
    if (body.mode !== "USE" && body.mode !== "RESTOCK")
      return NextResponse.json({ ok: false, error: "Invalid mode" });

    const supabase = getServiceClient();

    const mainId = process.env.MAIN_SUPPLY_AREA_ID;
    const storage_area_id = body.mainOverride ? mainId : body.storage_area_id;

    if (!storage_area_id) {
      return NextResponse.json({
        ok: false,
        error: body.mainOverride
          ? "Missing env MAIN_SUPPLY_AREA_ID"
          : "Missing storage_area_id",
      });
    }

    // Ensure storage_inventory row exists
    await supabase.from("storage_inventory").upsert(
      {
        storage_area_id,
        item_id: body.item_id,
        on_hand: 0,
        par_level: 0,
      },
      { onConflict: "storage_area_id,item_id" }
    );

    // Read current on_hand
    const { data: invRow, error: invErr } = await supabase
      .from("storage_inventory")
      .select("on_hand")
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", body.item_id)
      .single();

    if (invErr) throw invErr;

    const current = Math.trunc(Number(invRow?.on_hand ?? 0));
    const next =
      body.mode === "RESTOCK"
        ? current + qty
        : Math.max(0, current - qty);

    // Update location on_hand
    const { error: updErr } = await supabase
      .from("storage_inventory")
      .update({ on_hand: next })
      .eq("storage_area_id", storage_area_id)
      .eq("item_id", body.item_id);

    if (updErr) throw updErr;

    // Ensure building totals row exists
    await supabase
      .from("building_inventory")
      .upsert({ item_id: body.item_id, total_on_hand: 0 }, { onConflict: "item_id" });

    // Update building totals
    const delta = body.mode === "RESTOCK" ? qty : -qty;

    const { data: biRow, error: biErr } = await supabase
      .from("building_inventory")
      .select("total_on_hand")
      .eq("item_id", body.item_id)
      .single();

    if (biErr) throw biErr;

    const curTotal = Math.trunc(Number(biRow?.total_on_hand ?? 0));
    const nextTotal = Math.max(0, curTotal + delta);

    const { error: biUpdErr } = await supabase
      .from("building_inventory")
      .update({ total_on_hand: nextTotal })
      .eq("item_id", body.item_id);

    if (biUpdErr) throw biUpdErr;

    return NextResponse.json({ ok: true, on_hand: next, building_total: nextTotal });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
