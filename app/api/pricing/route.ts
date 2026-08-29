import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function nullableText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : null;
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) {
      return NextResponse.json({ ok: false, error: "Administrator access required" }, { status: 403 });
    }

    const body = await req.json();
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    if (!itemId) {
      return NextResponse.json({ ok: false, error: "Item is required" }, { status: 400 });
    }

    const price =
      body.price === null || body.price === "" ? null : Number(body.price);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10000000)) {
      return NextResponse.json({ ok: false, error: "Enter a valid price" }, { status: 400 });
    }

    const unitsPerBox =
      body.units_per_box === null || body.units_per_box === ""
        ? null
        : Number(body.units_per_box);
    if (
      unitsPerBox !== null &&
      (!Number.isInteger(unitsPerBox) || unitsPerBox < 1 || unitsPerBox > 100000)
    ) {
      return NextResponse.json(
        { ok: false, error: "Package quantity must be a whole number of at least 1" },
        { status: 400 }
      );
    }

    const vendor = nullableText(body.vendor, 200);
    const source = nullableText(body.source, 120);

    const { data: current, error: currentError } = await supabaseAdmin
      .from("items")
      .select("id,name,price,vendor,units_per_box,price_source,price_updated_at")
      .eq("id", itemId)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });
    }

    const normalizedPrice = price === null ? null : Math.round(price * 100) / 100;
    const unchanged =
      Number(current.price ?? 0) === Number(normalizedPrice ?? 0) &&
      (current.vendor || null) === vendor &&
      (current.units_per_box || null) === unitsPerBox &&
      (current.price_source || null) === source;

    if (unchanged) {
      return NextResponse.json({ ok: true, item: current, changed: false });
    }

    const updatedAt = new Date().toISOString();
    const update = {
      price: normalizedPrice,
      vendor,
      units_per_box: unitsPerBox,
      price_source: source,
      price_updated_at: updatedAt,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("items")
      .update(update)
      .eq("id", itemId)
      .select("id,name,price,vendor,units_per_box,price_source,price_updated_at")
      .single();

    if (updateError) throw updateError;

    const changedByName =
      authData.user.user_metadata?.full_name?.trim() ||
      authData.user.email ||
      "Administrator";

    const { error: historyError } = await supabaseAdmin
      .from("item_price_history")
      .insert({
        item_id: itemId,
        previous_price: current.price,
        new_price: normalizedPrice,
        previous_units_per_box: current.units_per_box,
        new_units_per_box: unitsPerBox,
        previous_vendor: current.vendor,
        new_vendor: vendor,
        source,
        changed_by: authData.user.id,
        changed_by_name: changedByName,
      });

    if (historyError) {
      await supabaseAdmin
        .from("items")
        .update({
          price: current.price,
          vendor: current.vendor,
          units_per_box: current.units_per_box,
          price_source: current.price_source,
          price_updated_at: current.price_updated_at,
        })
        .eq("id", itemId);
      throw historyError;
    }

    return NextResponse.json({ ok: true, item: updated, changed: true });
  } catch (error: any) {
    console.error("Pricing update failed:", error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: "Pricing update failed" },
      { status: 500 }
    );
  }
}
