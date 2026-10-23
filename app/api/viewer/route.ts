import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic="force-dynamic";
async function pages<T>(read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>){
  const rows:T[]=[];
  for(let start=0;;start+=500){const {data,error}=await read(start,start+499);if(error)throw new Error(error.message);rows.push(...(data||[]));if(!data||data.length<500)return rows;}
}
export async function GET(request:Request){
  const headers={"Cache-Control":"private, no-store"};
  try{
    const token=(request.headers.get("authorization")||"").replace(/^Bearer /,"");
    const {data:auth,error}=await supabaseAdmin.auth.getUser(token);
    if(error||!auth.user)return NextResponse.json({error:"Please sign in."},{status:401,headers});
    const role=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",auth.user.id).maybeSingle();
    if(role.error||!role.data||!["viewer","admin"].includes(role.data.role))return NextResponse.json({error:"View-only account access required."},{status:403,headers});
    const [items,totals,orders,locations,areas]=await Promise.all([
      pages((a,b)=>supabaseAdmin.from("items").select("id,name,reference_number,vendor,category,unit,par_level,low_level,price,notes,alert_note,is_active,order_status,backordered,expiration_date").order("id").range(a,b)),
      pages((a,b)=>supabaseAdmin.from("building_totals").select("item_id,building_on_hand").order("item_id").range(a,b)),
      pages((a,b)=>supabaseAdmin.from("order_requests").select("id,created_at,item_name,reference_number,vendor,unit,qty_requested,qty_actual_ordered,qty_actual_received,status,requested_by,confirmed_by,confirmed_at,received_at,expected_delivery_date,notes,item_note,issue_note,receipt_exception_note").order("created_at",{ascending:false}).order("id").range(a,b)),
      pages((a,b)=>supabaseAdmin.from("storage_inventory").select("item_id,storage_area_id,on_hand,shelf").or("on_hand.gt.0,shelf.not.is.null").order("item_id").order("storage_area_id").range(a,b)),
      supabaseAdmin.from("storage_areas").select("id,name").order("id"),
    ]);
    if(areas.error)throw areas.error;
    const quantities=new Map(totals.map(t=>[t.item_id,t.building_on_hand??0]));
    const names=new Map((areas.data||[]).map(a=>[a.id,a.name.trim()]));
    const byItem=new Map<string,{area:string;on_hand:number|null;shelf:string|null}[]>();
    for(const l of locations){const list=byItem.get(l.item_id)||[];list.push({area:names.get(l.storage_area_id)||"Storage area",on_hand:l.on_hand,shelf:l.shelf});byItem.set(l.item_id,list);}
    return NextResponse.json({items:items.map(i=>({...i,on_hand:quantities.get(i.id)??0,locations:byItem.get(i.id)||[]})),orders,updated_at:new Date().toISOString()},{headers});
  }catch(error){console.error("Viewer inventory load failed",error instanceof Error?error.message:"Unknown error");return NextResponse.json({error:"Could not refresh the live inventory. Please try again."},{status:500,headers});}
}
