import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body =
  | { name: string; action: "SET"; value: number }
  | { name: string; action: "ADJUST"; delta: number }
  | { name: string; action: "SET_PAR"; par_level: number };

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

function toInt(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) throw new Error("Not a number");
  return Math.trunc(x);
}

async function getItemIdByName(
  supabase: ReturnType<typeof getServiceClient>,
  name: string
) {
  // If there are duplicates by name, we still take the first.
  const { data, error } = await supabase
    .from("items")
    .select("id,name")
    .eq("name", name)
    .limit(2);

  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Item not found: ${name}`);

  if (data.length > 1) {
    console.warn(`Multiple items share name "${name}". Using first match.`);
  }

  return data[0].id as string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing item name" },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const supabase = getServiceClient();

    // Resolve item_id from items table
    const item_id = await getItemIdByName(supabase, name);

    // ---------------------------
    // PAR UPDATE -> items.par_level
    // ---------------------------
    if (body.action === "SET_PAR") {
      const par = toInt((body as any).par_level);
      if (par < 0) {
        return NextResponse.json(
          { ok: false, error: "par_level must be >= 0" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("items")
        .update({ par_level: par })
        .eq("id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, item_id, par_level: par });
    }

    // ---------------------------
    // BUILDING ON HAND -> building_totals.building_on_hand
    // ---------------------------

    // Make sure row exists (upsert)
    const ensureRow = async () => {
      const { error } = await supabase.from("building_totals").upsert(
        {
          item_id,
          building_on_hand: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "item_id" }
      );
      if (error) throw error;
    };

    await ensureRow();

    if (body.action === "SET") {
      const value = toInt((body as any).value);
      if (value < 0) {
        return NextResponse.json(
          { ok: false, error: "SET value must be >= 0" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("building_totals")
        .update({ building_on_hand: value, updated_at: new Date().toISOString() })
        .eq("item_id", item_id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, item_id, building_on_hand: value });
    }

    // ADJUST
    const delta = toInt((body as any).delta);
    if (delta === 0) {
      return NextResponse.json(
        { ok: false, error: "ADJUST delta must be non-zero" },
        { status: 400 }
      );
    }

    const { data: btRow, error: btErr } = await supabase
      .from("building_totals")
      .select("building_on_hand")
      .eq("item_id", item_id)
      .maybeSingle();

    if (btErr) {
      return NextResponse.json({ ok: false, error: btErr.message }, { status: 400 });
    }

    const current = Number(btRow?.building_on_hand ?? 0);
    const next = Math.max(0, current + delta);

    const { error: updErr } = await supabase
      .from("building_totals")
      .update({ building_on_hand: next, updated_at: new Date().toISOString() })
      .eq("item_id", item_id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      item_id,
      previous: current,
      delta,
      building_on_hand: next,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
