import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body =
  | { item_id: string; action: "SET"; value: number }
  | { item_id: string; action: "ADJUST"; delta: number }
  | { item_id: string; action: "SET_PAR"; par_level: number }
  | {
      item_id: string;
      action: "SAVE_ITEM_META";
      vendor?: string | null;
      category?: string | null;
      unit?: string | null;
      notes?: string | null;
      low_level: number;
      reference_number_new?: string | null;
      supply_source?: string | null;
    }
  | { item_id: string; action: "SET_ACTIVE"; is_active: boolean };

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

    const item_id = String((body as any)?.item_id ?? "").trim();
    if (!item_id) {
      return NextResponse.json({ ok: false, error: "Missing item_id" });
    }

    const supabase = getServiceClient();

    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id,name")
      .eq("id", item_id)
      .single();

    if (itemErr || !item?.id) {
      return NextResponse.json({
        ok: false,
        error: `Item not found for item_id: ${item_id}`,
      });
    }

    if ((body as any).action === "SET_ACTIVE") {
      const is_active = Boolean((body as any).is_active);

      const { error } = await supabase
        .from("items")
        .update({ is_active })
        .eq("id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      return NextResponse.json({ ok: true });
    }

    if ((body as any).action === "SAVE_ITEM_META") {
      const low = Number((body as any).low_level);
      if (!Number.isFinite(low) || low < 0) {
        return NextResponse.json({
          ok: false,
          error: "low_level must be a number >= 0",
        });
      }

      const payload: Record<string, any> = {
        vendor:
          typeof (body as any).vendor === "string"
            ? ((body as any).vendor as string).trim() || null
            : null,
        category:
          typeof (body as any).category === "string"
            ? ((body as any).category as string).trim() || null
            : null,
        unit:
          typeof (body as any).unit === "string"
            ? ((body as any).unit as string).trim() || null
            : null,
        notes:
          typeof (body as any).notes === "string"
            ? ((body as any).notes as string).trim() || null
            : null,
        low_level: Math.trunc(low),
        reference_number:
          typeof (body as any).reference_number_new === "string"
            ? ((body as any).reference_number_new as string).trim() || null
            : null,
      };

      if (typeof (body as any).supply_source === "string") {
        payload.supply_source = (body as any).supply_source.trim() || null;
      }

      if ((body as any).price !== undefined) {
        const p = Number((body as any).price);
        payload.price = Number.isFinite(p) && p >= 0 ? p : null;
      }

      if ((body as any).expiration_date !== undefined) {
        payload.expiration_date = (body as any).expiration_date || null;
      }

      const { error } = await supabase
        .from("items")
        .update(payload)
        .eq("id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      return NextResponse.json({ ok: true });
    }

    if ((body as any).action === "SET_PAR") {
      const par = Number((body as any).par_level);
      if (!Number.isFinite(par) || par < 0) {
        return NextResponse.json({
          ok: false,
          error: "par_level must be a number >= 0",
        });
      }

      const { error } = await supabase
        .from("items")
        .update({ par_level: Math.trunc(par) })
        .eq("id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      return NextResponse.json({ ok: true });
    }

    const { error: upsertErr } = await supabase
      .from("building_totals")
      .upsert({ item_id, building_on_hand: 0 }, { onConflict: "item_id" });

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message });
    }

    if ((body as any).action === "SET") {
      const value = Number((body as any).value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({
          ok: false,
          error: "SET value must be a number >= 0",
        });
      }

      const { error } = await supabase
        .from("building_totals")
        .update({ building_on_hand: Math.trunc(value) })
        .eq("item_id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message });
      }

      return NextResponse.json({ ok: true });
    }

    const delta = Number((body as any).delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({
        ok: false,
        error: "ADJUST delta must be a non-zero number",
      });
    }

    const { data: btRow, error: btErr } = await supabase
      .from("building_totals")
      .select("building_on_hand")
      .eq("item_id", item_id)
      .single();

    if (btErr) {
      return NextResponse.json({ ok: false, error: btErr.message });
    }

    const current = Number(btRow?.building_on_hand ?? 0);
    const next = Math.max(0, current + Math.trunc(delta));

    const { error: updErr } = await supabase
      .from("building_totals")
      .update({ building_on_hand: next })
      .eq("item_id", item_id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message ?? "Unknown error",
    });
  }
}
