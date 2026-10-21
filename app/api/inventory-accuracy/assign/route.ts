import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
  try{
    const header=request.headers.get("authorization")||"";
    if(!header.startsWith("Bearer "))return NextResponse.json({ok:false,error:"Sign in required"},{status:401});
    const {data,error}=await supabaseAdmin.auth.getUser(header.slice(7));
    if(error||!data.user)return NextResponse.json({ok:false,error:"Please sign in again"},{status:401});
    const role=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",data.user.id).eq("role","admin").limit(1).maybeSingle();
    if(role.error||!role.data)return NextResponse.json({ok:false,error:"Administrator access required"},{status:403});
    const body=await request.json();
    if(!uuid.test(body?.item_id||"")||!uuid.test(body?.area_id||""))return NextResponse.json({ok:false,error:"Choose an item and storage area"},{status:400});
    const [item,area]=await Promise.all([
      supabaseAdmin.from("items").select("id,unit").eq("id",body.item_id).eq("is_active",true).single(),
      supabaseAdmin.from("storage_areas").select("id").eq("id",body.area_id).eq("active",true).single(),
    ]);
    if(item.error||area.error)return NextResponse.json({ok:false,error:"Choose an active item and area"},{status:400});
    // DO NOTHING on a duplicate: never replace an existing live quantity with zero.
    const inserted=await supabaseAdmin.from("storage_inventory").upsert({item_id:body.item_id,storage_area_id:body.area_id,on_hand:0,par_level:0,low_level:0},{onConflict:"item_id,storage_area_id",ignoreDuplicates:true});
    if(inserted.error)throw inserted.error;
    const saved=await supabaseAdmin.from("storage_inventory").select("on_hand,shelf,updated_at").eq("item_id",body.item_id).eq("storage_area_id",body.area_id).single();
    if(saved.error)throw saved.error;
    return NextResponse.json({ok:true,stock:saved.data,unit:item.data.unit});
  }catch(error){console.error("Accuracy assignment failed:",error instanceof Error?error.message:error);return NextResponse.json({ok:false,error:"Could not add this item to the area. Reload before trying again."},{status:500});}
}
