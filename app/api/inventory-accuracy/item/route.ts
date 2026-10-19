import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabaseAdmin";

const fields = "name,reference_number,vendor,category,unit,par_level,low_level,units_per_box,price,notes,alert_note,price_updated_at";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function admin(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const {data, error} = await supabaseAdmin.auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  const role = await supabaseAdmin.from("app_user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").limit(1).maybeSingle();
  return role.data && !role.error ? data.user : null;
}
async function read(itemId: string, areaId: string) {
  const [item, area] = await Promise.all([
    supabaseAdmin.from("items").select(fields).eq("id", itemId).eq("is_active", true).single(),
    supabaseAdmin.from("storage_inventory").select("shelf").eq("item_id", itemId).eq("storage_area_id", areaId).single(),
  ]);
  if (item.error || area.error) throw new Error("Item is unavailable in this area");
  return {...item.data, shelf: area.data.shelf};
}
export async function GET(request: Request) {
  if (!await admin(request)) return NextResponse.json({ok:false,error:"Administrator access required"},{status:403});
  const query = new URL(request.url).searchParams, itemId = query.get("item_id") || "", areaId = query.get("area_id") || "";
  if (!uuid.test(itemId) || !uuid.test(areaId)) return NextResponse.json({ok:false,error:"Choose a valid item and area"},{status:400});
  try {return NextResponse.json({ok:true,item:await read(itemId,areaId)},{headers:{"Cache-Control":"private, no-store"}});}
  catch {return NextResponse.json({ok:false,error:"Item is unavailable in this area"},{status:404});}
}
export async function PATCH(request: Request) {
  const user = await admin(request);
  if (!user) return NextResponse.json({ok:false,error:"Administrator access required"},{status:403});
  try {
    const body = await request.json(), details = body?.details;
    if (!uuid.test(body?.item_id || "") || !uuid.test(body?.area_id || "") || !details || !body.expected || typeof body.expected !== "object") return NextResponse.json({ok:false,error:"Item details are incomplete"},{status:400});
    const clean: Record<string,string|number|null> = {};
    for (const [key, max] of Object.entries({name:300,reference_number:200,vendor:200,category:200,unit:80,notes:2000,alert_note:500,shelf:120})) {
      const value = details[key];
      if (value !== null && typeof value !== "string") throw new Error(`Enter valid ${key.replaceAll("_"," ")}`);
      const text = typeof value === "string" ? value.trim() : "";
      if (text.length > max || (key === "name" && !text)) throw new Error(`Check ${key.replaceAll("_"," ")}`);
      clean[key] = text || null;
    }
    for (const [key, max] of Object.entries({par_level:1000000,low_level:1000000,units_per_box:100000,price:10000000})) {
      const value = details[key];
      if (value === null) {clean[key] = null;continue;}
      if (typeof value !== "number" || !Number.isFinite(value) || value < (key === "units_per_box" ? 1 : 0) || value > max || (key !== "price" && !Number.isInteger(value))) throw new Error(`Check ${key.replaceAll("_"," ")}`);
      clean[key] = key === "price" ? Math.round(value * 100) / 100 : value;
    }
    const {data,error} = await supabaseAdmin.rpc("edit_counted_item_details",{
      p_item_id:body.item_id,p_area_id:body.area_id,p_expected:body.expected,p_details:clean,
      p_user_id:user.id,p_staff:user.user_metadata?.full_name || user.email || "Administrator",p_confirm_units:body.confirm_units === true,
    });
    if (error) {
      if (error.message.includes("ITEM_DETAILS_CONFLICT")) return NextResponse.json({ok:false,error:"Someone changed this item. Close and reopen Edit Item Info to load the latest details. Your entered counts are still here."},{status:409});
      if (error.message.includes("CONFIRM_UNIT_CHANGE")) return NextResponse.json({ok:false,error:"Confirm the unit change and recount this item."},{status:400});
      console.error("Item detail save failed:",error.message);
      return NextResponse.json({ok:false,error:"Could not save item info. No changes were saved."},{status:500});
    }
    return NextResponse.json({ok:true,units_changed:Boolean(data?.units_changed),details:clean});
  } catch (error) {return NextResponse.json({ok:false,error:error instanceof Error ? error.message : "Check the item details"},{status:400});}
}
