import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body =
  | { name: string; action: "SET"; value: number }
  | { name: string; action: "ADJUST"; delta: number }
  | { name: string; action: "SET_PAR"; value: number };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json({ ok: false, error: "Missing item name" });
    }

    const supabase = getServiceClient();

    // Find item by unique name
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id,name")
      .eq("name", body.name)
      .single();

    if (itemErr || !item?.id) {
      return NextResponse.json({
        ok: false,
        error: `Item not found by name: ${body.name}`,
      });
    }

    const item_id = item.id as string;

    // Ensure row exists (keep existing behavior)
    await supabase
      .from("building_inventory")
      .upsert({ item_id, total_on_hand: 0 }, { onConflict: "item_id" });

    // ✅ SET total_on_hand exact
    if (body.action === "SET") {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({
          ok: false,
          error: "SET value must be a number >= 0",
        });
      }

      const { error } = await supabase
        .from("building_inventory")
        .update({ total_on_hand: Math.trunc(value) })
        .eq("item_id", item_id);

      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    // ✅ NEW: SET_PAR par_level exact
    if (body.action === "SET_PAR") {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({
          ok: false,
          error: "SET_PAR value must be a number >= 0",
        });
      }

      const { error } = await supabase
        .from("building_inventory")
        .update({ par_level: Math.trunc(value) })
        .eq("item_id", item_id);

      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    }

    // ✅ ADJUST total_on_hand +/- delta
    const delta = Number((body as any).delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({
        ok: false,
        error: "ADJUST delta must be a non-zero number",
      });
    }

    const { data: biRow, error: biErr } = await supabase
      .from("building_inventory")
      .select("total_on_hand")
      .eq("item_id", item_id)
      .single();

    if (biErr) return NextResponse.json({ ok: false, error: biErr.message });

    const current = Number(biRow?.total_on_hand ?? 0);
    const next = Math.max(0, current + Math.trunc(delta));

    const { error: updErr } = await supabase
      .from("building_inventory")
      .update({ total_on_hand: next })
      .eq("item_id", item_id);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
