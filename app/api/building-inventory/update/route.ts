import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body =
  | {
      action: "SET";
      value: number;
      item_id?: string;
      reference_number?: string | null;
      name?: string;
    }
  | {
      action: "ADJUST";
      delta: number;
      item_id?: string;
      reference_number?: string | null;
      name?: string;
    }
  | {
      action: "SET_PAR";
      par_level: number;
      item_id?: string;
      reference_number?: string | null;
      name?: string;
    }
  | {
      action: "SAVE_ITEM_META";
      item_id?: string;
      reference_number?: string | null;
      name?: string;
      vendor?: string | null;
      category?: string | null;
      unit?: string | null;
      notes?: string | null;
      low_level?: number | null;
      reference_number_new?: string | null;
    };

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

function asInt(val: unknown, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function cleanNullableString(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function resolveItemId(
  supabase: ReturnType<typeof getServiceClient>,
  body: Body
) {
  if ("item_id" in body && body.item_id && typeof body.item_id === "string") {
    return body.item_id;
  }

  if (
    "reference_number" in body &&
    body.reference_number &&
    typeof body.reference_number === "string"
  ) {
    const ref = body.reference_number.trim();
    const { data, error } = await supabase
      .from("items")
      .select("id")
      .eq("reference_number", ref)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  if ("name" in body && body.name && typeof body.name === "string") {
    const name = body.name.trim();

    const { data: exact, error: exactErr } = await supabase
      .from("items")
      .select("id,name")
      .eq("name", name)
      .limit(2);

    if (exactErr) throw exactErr;

    if (exact && exact.length === 1) {
      return exact[0].id as string;
    }

    if (exact && exact.length > 1) {
      throw new Error(
        `Multiple items match "${name}". Use reference number or item_id.`
      );
    }

    const { data: fuzzy, error: fuzzyErr } = await supabase
      .from("items")
      .select("id,name")
      .ilike("name", name)
      .limit(2);

    if (fuzzyErr) throw fuzzyErr;

    if (fuzzy && fuzzy.length === 1) {
      return fuzzy[0].id as string;
    }

    if (fuzzy && fuzzy.length > 1) {
      throw new Error(
        `Multiple items match "${name}". Use reference number or item_id.`
      );
    }

    throw new Error(`Item not found: ${name}`);
  }

  throw new Error("Missing item identifier");
}

async function ensureBuildingTotalsRow(
  supabase: ReturnType<typeof getServiceClient>,
  item_id: string
) {
  const { error } = await supabase.from("building_totals").upsert(
    {
      item_id,
      building_on_hand: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_id" }
  );

  if (error) throw error;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const supabase = getServiceClient();
    const item_id = await resolveItemId(supabase, body);

    if (body.action === "SET_PAR") {
      const par = asInt(body.par_level, -1);
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
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, item_id, par_level: par });
    }

    if (body.action === "SAVE_ITEM_META") {
      const payload = {
        vendor: cleanNullableString(body.vendor),
        category: cleanNullableString(body.category),
        unit: cleanNullableString(body.unit),
        notes: cleanNullableString(body.notes),
        low_level:
          body.low_level === null || body.low_level === undefined
            ? null
            : Math.max(0, asInt(body.low_level, 0)),
        reference_number: cleanNullableString(body.reference_number_new),
      };

      const { error } = await supabase.from("items").update(payload).eq("id", item_id);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, item_id });
    }

    await ensureBuildingTotalsRow(supabase, item_id);

    if (body.action === "SET") {
      const value = asInt(body.value, -1);
      if (value < 0) {
        return NextResponse.json(
          { ok: false, error: "value must be >= 0" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("building_totals")
        .update({
          building_on_hand: value,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item_id);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, item_id, building_on_hand: value });
    }

    if (body.action === "ADJUST") {
      const delta = asInt(body.delta, 0);
      if (delta === 0) {
        return NextResponse.json(
          { ok: false, error: "delta must be non-zero" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("building_totals")
        .select("building_on_hand")
        .eq("item_id", item_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        );
      }

      const current = asInt(data?.building_on_hand, 0);
      const next = Math.max(0, current + delta);

      const { error: updErr } = await supabase
        .from("building_totals")
        .update({
          building_on_hand: next,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item_id);

      if (updErr) {
        return NextResponse.json(
          { ok: false, error: updErr.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        item_id,
        previous: current,
        building_on_hand: next,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
