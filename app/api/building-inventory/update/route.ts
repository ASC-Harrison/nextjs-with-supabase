// app/api/building-inventory/update/route.ts
import { NextResponse } from "next/server";
import { createClient, PostgrestError } from "@supabase/supabase-js";

/**
 * This route is intentionally DEFENSIVE:
 * - It can identify an item by: item_id OR reference_number OR name (exact / case-insensitive)
 * - It updates your "building totals" in whatever table/column you currently have:
 *    1) building_totals.building_on_hand   (recommended)
 *    2) building_inventory.total_on_hand
 *    3) building_inventory.building_on_hand
 *
 * So you stop getting "column does not exist" + "item not found" errors.
 */

type Body =
  | {
      action: "SET";
      value: number;
      item_id?: string;
      reference_number?: string;
      name?: string;
    }
  | {
      action: "ADJUST";
      delta: number;
      item_id?: string;
      reference_number?: string;
      name?: string;
    }
  | {
      action: "SET_PAR";
      par_level: number;
      item_id?: string;
      reference_number?: string;
      name?: string;
    };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function truncInt(n: number) {
  return Math.trunc(n);
}

function errMsg(e: any) {
  return e?.message ?? e?.error_description ?? "Unknown error";
}

async function findItemId(
  supabase: ReturnType<typeof getServiceClient>,
  body: Body
): Promise<{ item_id: string; method: string } | { error: string }> {
  // 1) item_id directly
  if (body.item_id && typeof body.item_id === "string") {
    return { item_id: body.item_id, method: "item_id" };
  }

  // 2) reference_number exact (best if you have it)
  if (body.reference_number && typeof body.reference_number === "string") {
    const ref = body.reference_number.trim();
    if (ref) {
      const { data, error } = await supabase
        .from("items")
        .select("id")
        .eq("reference_number", ref)
        .maybeSingle();

      if (error) return { error: error.message };
      if (data?.id) return { item_id: data.id, method: "reference_number" };
    }
  }

  // 3) name exact (current behavior)
  if (body.name && typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return { error: "Missing item identifier (name empty)" };

    // Try exact match first
    {
      const { data, error } = await supabase
        .from("items")
        .select("id")
        .eq("name", name)
        .maybeSingle();

      if (error) return { error: error.message };
      if (data?.id) return { item_id: data.id, method: "name_exact" };
    }

    // Then case-insensitive match
    {
      const { data, error } = await supabase
        .from("items")
        .select("id,name")
        .ilike("name", name)
        .maybeSingle();

      if (error) return { error: error.message };
      if (data?.id) return { item_id: data.id, method: "name_ilike" };
    }

    // Finally, try a "contains" search to catch small differences.
    // If it returns multiple rows, we refuse (safer than updating the wrong item).
    {
      const { data, error } = await supabase
        .from("items")
        .select("id,name")
        .ilike("name", `%${name.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
        .limit(5);

      if (error) return { error: error.message };

      if (!data || data.length === 0) {
        return { error: `Item not found: ${name}` };
      }

      if (data.length > 1) {
        return {
          error:
            `Multiple items match "${name}". ` +
            `Use reference_number (preferred) or item_id to update safely.`,
        };
      }

      return { item_id: data[0].id, method: "name_contains_single" };
    }
  }

  return { error: "Missing item identifier. Send item_id or reference_number or name." };
}

async function tryUpsertBuildingOnHand(
  supabase: ReturnType<typeof getServiceClient>,
  item_id: string,
  onHandValue: number
): Promise<{ ok: true; target: string } | { ok: false; error: string }> {
  const v = Math.max(0, truncInt(onHandValue));

  // Attempt A: building_totals.building_on_hand
  {
    const { error } = await supabase
      .from("building_totals")
      .upsert({ item_id, building_on_hand: v }, { onConflict: "item_id" });

    if (!error) return { ok: true, target: "building_totals.building_on_hand" };
  }

  // Attempt B: building_inventory.total_on_hand
  {
    const { error } = await supabase
      .from("building_inventory")
      .upsert({ item_id, total_on_hand: v }, { onConflict: "item_id" });

    if (!error) return { ok: true, target: "building_inventory.total_on_hand" };
  }

  // Attempt C: building_inventory.building_on_hand
  {
    const { error } = await supabase
      .from("building_inventory")
      .upsert({ item_id, building_on_hand: v }, { onConflict: "item_id" });

    if (!error) return { ok: true, target: "building_inventory.building_on_hand" };
  }

  return {
    ok: false,
    error:
      "Could not write building on-hand. I tried:\n" +
      "- building_totals.building_on_hand\n" +
      "- building_inventory.total_on_hand\n" +
      "- building_inventory.building_on_hand\n" +
      "One of those tables/columns must exist for totals updates to work.",
  };
}

async function readCurrentBuildingOnHand(
  supabase: ReturnType<typeof getServiceClient>,
  item_id: string
): Promise<{ ok: true; value: number; source: string } | { ok: false; error: string }> {
  // Attempt A
  {
    const { data, error } = await supabase
      .from("building_totals")
      .select("building_on_hand")
      .eq("item_id", item_id)
      .maybeSingle();

    if (!error && data && typeof (data as any).building_on_hand !== "undefined") {
      return {
        ok: true,
        value: Number((data as any).building_on_hand ?? 0) || 0,
        source: "building_totals.building_on_hand",
      };
    }
  }

  // Attempt B
  {
    const { data, error } = await supabase
      .from("building_inventory")
      .select("total_on_hand")
      .eq("item_id", item_id)
      .maybeSingle();

    if (!error && data && typeof (data as any).total_on_hand !== "undefined") {
      return {
        ok: true,
        value: Number((data as any).total_on_hand ?? 0) || 0,
        source: "building_inventory.total_on_hand",
      };
    }
  }

  // Attempt C
  {
    const { data, error } = await supabase
      .from("building_inventory")
      .select("building_on_hand")
      .eq("item_id", item_id)
      .maybeSingle();

    if (!error && data && typeof (data as any).building_on_hand !== "undefined") {
      return {
        ok: true,
        value: Number((data as any).building_on_hand ?? 0) || 0,
        source: "building_inventory.building_on_hand",
      };
    }
  }

  // If missing row, treat as 0 (we can still upsert on SET)
  return { ok: true, value: 0, source: "default_0" };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.action) {
      return NextResponse.json({ ok: false, error: "Missing action" });
    }

    const supabase = getServiceClient();

    // ---- Find item_id safely ----
    const found = await findItemId(supabase, body);
    if ("error" in found) {
      return NextResponse.json({ ok: false, error: found.error });
    }
    const item_id = found.item_id;

    // ---- PAR updates go on items.par_level ----
    if (body.action === "SET_PAR") {
      const par = (body as any).par_level;
      if (!isFiniteNumber(par) || par < 0) {
        return NextResponse.json({
          ok: false,
          error: "par_level must be a number >= 0",
        });
      }

      const { error } = await supabase
        .from("items")
        .update({ par_level: truncInt(par) })
        .eq("id", item_id);

      if (error) return NextResponse.json({ ok: false, error: error.message });

      return NextResponse.json({ ok: true });
    }

    // ---- SET exact building on-hand ----
    if (body.action === "SET") {
      const value = (body as any).value;
      if (!isFiniteNumber(value) || value < 0) {
        return NextResponse.json({
          ok: false,
          error: "SET value must be a number >= 0",
        });
      }

      const write = await tryUpsertBuildingOnHand(supabase, item_id, value);
      if (!write.ok) return NextResponse.json({ ok: false, error: write.error });

      return NextResponse.json({ ok: true, item_id, wrote_to: write.target });
    }

    // ---- ADJUST building on-hand (+/-) ----
    if (body.action === "ADJUST") {
      const delta = (body as any).delta;
      if (!isFiniteNumber(delta) || delta === 0) {
        return NextResponse.json({
          ok: false,
          error: "ADJUST delta must be a non-zero number",
        });
      }

      const cur = await readCurrentBuildingOnHand(supabase, item_id);
      if (!cur.ok) return NextResponse.json({ ok: false, error: cur.error });

      const next = Math.max(0, truncInt(cur.value + truncInt(delta)));

      const write = await tryUpsertBuildingOnHand(supabase, item_id, next);
      if (!write.ok) return NextResponse.json({ ok: false, error: write.error });

      return NextResponse.json({
        ok: true,
        item_id,
        from: cur.value,
        to: next,
        read_from: cur.source,
        wrote_to: write.target,
      });
    }

    return NextResponse.json({ ok: false, error: `Unsupported action: ${(body as any).action}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
}
