import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function requireAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: role } = await supabaseAdmin
    .from("app_user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  return role ? data.user : null;
}

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ ok:false, error:"Administrator access required" }, { status:403 });
  }

  const requestedArea = new URL(request.url).searchParams.get("area_id") || "";
  const { data:areas, error:areaError } = await supabaseAdmin
    .from("storage_areas")
    .select("id,name,is_main")
    .eq("active", true)
    .order("is_main", { ascending:false })
    .order("name");

  if (areaError) {
    return NextResponse.json({ ok:false, error:areaError.message }, { status:500 });
  }

  const areaId = UUID_RE.test(requestedArea)
    ? requestedArea
    : String(areas?.[0]?.id || "");

  if (!areaId || !areas?.some(area => area.id === areaId)) {
    return NextResponse.json({ ok:false, error:"Choose an active storage area" }, { status:400 });
  }

  const [inventoryResult, itemsResult, verificationResult] = await Promise.all([
    supabaseAdmin
      .from("storage_inventory")
      .select("item_id,on_hand,shelf,updated_at")
      .eq("storage_area_id", areaId),
    supabaseAdmin
      .from("items")
      .select("id,name,reference_number,vendor,unit,category")
      .eq("is_active", true),
    supabaseAdmin
      .from("inventory_count_verifications")
      .select("item_id,actual_on_hand,difference,verified_by,verified_at")
      .eq("storage_area_id", areaId)
      .order("verified_at", { ascending:false })
      .limit(2000),
  ]);

  if (inventoryResult.error || itemsResult.error || verificationResult.error) {
    return NextResponse.json({
      ok:false,
      error:inventoryResult.error?.message || itemsResult.error?.message || verificationResult.error?.message || "Could not load inventory",
    }, { status:500 });
  }

  const itemMap = new Map((itemsResult.data || []).map(item => [item.id, item]));
  const latestVerification = new Map<string, {
    actual_on_hand:number;
    difference:number;
    verified_by:string;
    verified_at:string;
  }>();

  for (const row of verificationResult.data || []) {
    if (!latestVerification.has(row.item_id)) {
      latestVerification.set(row.item_id, {
        actual_on_hand:Number(row.actual_on_hand),
        difference:Number(row.difference),
        verified_by:String(row.verified_by),
        verified_at:String(row.verified_at),
      });
    }
  }

  const rows = (inventoryResult.data || [])
    .map(row => {
      const item = itemMap.get(row.item_id);
      if (!item) return null;
      return {
        item_id:row.item_id,
        name:item.name,
        reference_number:item.reference_number,
        vendor:item.vendor,
        unit:item.unit,
        category:item.category,
        shelf:row.shelf,
        on_hand:Number(row.on_hand || 0),
        updated_at:row.updated_at,
        last_verification:latestVerification.get(row.item_id) || null,
      };
    })
    .filter(Boolean)
    .sort((a:any,b:any) => a.name.localeCompare(b.name));

  return NextResponse.json({ ok:true, areas:areas || [], selected_area_id:areaId, items:rows });
}

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ ok:false, error:"Administrator access required" }, { status:403 });
  }

  const body = await request.json().catch(() => null);
  const areaId = typeof body?.area_id === "string" ? body.area_id.trim() : "";
  const rawCounts = Array.isArray(body?.counts) ? body.counts : [];

  if (!UUID_RE.test(areaId)) {
    return NextResponse.json({ ok:false, error:"Choose a valid storage area" }, { status:400 });
  }
  if (rawCounts.length < 1 || rawCounts.length > 200) {
    return NextResponse.json({ ok:false, error:"Confirm between 1 and 200 counts at a time" }, { status:400 });
  }

  const seen = new Set<string>();
  const counts = [];
  for (const entry of rawCounts) {
    const itemId = typeof entry?.item_id === "string" ? entry.item_id.trim() : "";
    const expected = Number(entry?.expected_on_hand);
    const actual = Number(entry?.actual_on_hand);
    if (!UUID_RE.test(itemId) || !Number.isInteger(expected) || !Number.isInteger(actual) || expected < 0 || actual < 0) {
      return NextResponse.json({ ok:false, error:"Every item needs a valid whole-number count of zero or more" }, { status:400 });
    }
    if (seen.has(itemId)) {
      return NextResponse.json({ ok:false, error:"An item can only appear once in a count batch" }, { status:400 });
    }
    seen.add(itemId);
    counts.push({ item_id:itemId, expected_on_hand:expected, actual_on_hand:actual });
  }

  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user.email ||
    user.id;

  const { data, error } = await supabaseAdmin.rpc("apply_verified_inventory_counts", {
    p_storage_area_id:areaId,
    p_counts:counts,
    p_staff:displayName,
  });

  if (error) {
    const conflict = error.message.match(/COUNT_CONFLICT:([0-9a-f-]+):(\d+):(\d+)/i);
    if (conflict) {
      return NextResponse.json({
        ok:false,
        error:"A count changed on another device. Nothing was saved. Reload the area and review it again.",
        conflict:{ item_id:conflict[1], expected:Number(conflict[2]), current:Number(conflict[3]) },
      }, { status:409 });
    }
    if (error.message.includes("COUNT_MISSING")) {
      return NextResponse.json({
        ok:false,
        error:"An item is no longer assigned to this area. Nothing was saved. Reload and try again.",
      }, { status:409 });
    }
    return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  }

  const result = data?.[0] || { updated_count:0, unchanged_count:0 };
  const { data:confirmedRows, error:verifyError } = await supabaseAdmin
    .from("storage_inventory")
    .select("item_id,on_hand")
    .eq("storage_area_id", areaId)
    .in("item_id", counts.map(count => count.item_id));

  if (verifyError || (confirmedRows || []).length !== counts.length) {
    return NextResponse.json({
      ok:false,
      error:"Counts saved, but the confirmation read failed. Reload before entering anything else.",
    }, { status:500 });
  }

  return NextResponse.json({
    ok:true,
    updated_count:Number(result.updated_count || 0),
    unchanged_count:Number(result.unchanged_count || 0),
    confirmed:confirmedRows,
  });
}
