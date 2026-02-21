import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function requireAdmin(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SECRET in env.");

  const got = req.headers.get("x-admin-secret") || "";
  if (got !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// GET /api/admin/inventory?storage_area_id=...&q=...
export async function GET(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);

    const storage_area_id = searchParams.get("storage_area_id") || "";
    const qRaw = (searchParams.get("q") || "").trim().toLowerCase();

    // 1) Pull inventory rows
    let invQuery = supabase
      .from("storage_inventory")
      .select("storage_area_id,item_id,on_hand,par_level,low,low_notified,updated_at")
      .order("updated_at", { ascending: false });

    if (storage_area_id) invQuery = invQuery.eq("storage_area_id", storage_area_id);

    const { data: invRows, error: invErr } = await invQuery;
    if (invErr) throw invErr;

    const itemIds = Array.from(new Set((invRows || []).map((r) => r.item_id).filter(Boolean)));
    const areaIds = Array.from(new Set((invRows || []).map((r) => r.storage_area_id).filter(Boolean)));

    // 2) Pull items (your items table columns from your screenshot)
    let itemsById: Record<string, any> = {};
    if (itemIds.length) {
      const { data: items, error: itemsErr } = await supabase
        .from("items")
        .select("id,name,barcode,category,vendor,active,reference_number")
        .in("id", itemIds);

      if (itemsErr) throw itemsErr;

      for (const it of items || []) itemsById[it.id] = it;
    }

    // 3) Pull storage_areas for names
    let areasById: Record<string, any> = {};
    if (areaIds.length) {
      const { data: areas, error: areasErr } = await supabase
        .from("storage_areas")
        .select("id,name,location_id,active")
        .in("id", areaIds);

      if (areasErr) throw areasErr;
      for (const a of areas || []) areasById[a.id] = a;
    }

    // 4) Merge
    let rows = (invRows || []).map((r) => {
      const item = itemsById[r.item_id] || {};
      const area = areasById[r.storage_area_id] || {};
      return {
        storage_area_id: r.storage_area_id,
        storage_area_name: area.name || "—",
        item_id: r.item_id,
        item_name: item.name || "—",
        barcode: item.barcode || "",
        category: item.category || "",
        vendor: item.vendor || "",
        on_hand: r.on_hand ?? 0,
        par_level: r.par_level ?? 0,
        low: !!r.low,
        low_notified: !!r.low_notified,
        updated_at: r.updated_at,
      };
    });

    // 5) Search filter (optional)
    if (qRaw) {
      rows = rows.filter((r) => {
        const hay = `${r.item_name} ${r.barcode} ${r.category} ${r.vendor} ${r.storage_area_name}`.toLowerCase();
        return hay.includes(qRaw);
      });
    }

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
