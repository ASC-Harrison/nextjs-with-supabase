import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
  try{
    const header=request.headers.get("authorization")||"";
    if(!header.startsWith("Bearer "))return NextResponse.json({ok:false,error:"Sign in required"},{status:401});
    const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(header.slice(7));
    if(authError||!auth.user)return NextResponse.json({ok:false,error:"Please sign in again. Your entered count is kept on this device."},{status:401});
    const role=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",auth.user.id).eq("role","admin").limit(1).maybeSingle();
    if(role.error||!role.data)return NextResponse.json({ok:false,error:"Administrator access required"},{status:403});
    const body=await request.json();
    if(!uuid.test(body?.area_id||"")||!uuid.test(body?.item_id||"")||!Number.isInteger(body.expected_on_hand)||body.expected_on_hand<0||!Number.isInteger(body.actual_on_hand)||body.actual_on_hand<0||body.actual_on_hand>9999999||(body.unit!==null&&typeof body.unit!=="string"))return NextResponse.json({ok:false,error:"Enter a whole-number count of zero or more."},{status:400});
    const staff=(typeof auth.user.user_metadata?.full_name==="string"&&auth.user.user_metadata.full_name.trim())||auth.user.email||auth.user.id;
    const {data,error}=await supabaseAdmin.rpc("save_inventory_accuracy_count",{p_area_id:body.area_id,p_item_id:body.item_id,p_expected:body.expected_on_hand,p_actual:body.actual_on_hand,p_unit:body.unit,p_staff:staff});
    if(error){
      const conflict=/COUNT_CHANGED|COUNT_UNIT_CHANGED|COUNT_MISSING|ITEM_MISSING/.test(error.message);
      return NextResponse.json({ok:false,conflict,error:conflict?"This item or count changed. Reload the area, physically check it again, then re-enter the count. Your previous entry is kept for reference.":"Count could not be saved. Your entry is kept on this device; tap Retry."},{status:conflict?409:500});
    }
    return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({ok:false,error:"Could not save. Your entry is kept on this device; tap Retry."},{status:500});}
}
