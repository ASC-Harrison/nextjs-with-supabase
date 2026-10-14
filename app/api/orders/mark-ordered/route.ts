import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabaseAdmin";

const ALLOWED_ROLES=["admin","staff","preop","kaya"];

export async function POST(request:Request){
 try{
  const token=(request.headers.get("authorization")||"").replace(/^Bearer /,"");
  if(!token)return NextResponse.json({ok:false,error:"Sign in required"},{status:401});
  const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(token);
  if(authError||!auth.user)return NextResponse.json({ok:false,error:"Sign in required"},{status:401});
  const {data:role,error:roleError}=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",auth.user.id).in("role",ALLOWED_ROLES).maybeSingle();
  if(roleError)throw roleError;
  if(!role)return NextResponse.json({ok:false,error:"Ordering access required"},{status:403});

  const body=await request.json().catch(()=>null);
  const orderId=typeof body?.order_id==="string"?body.order_id.trim():"";
  const qty=Number(body?.qty_actual_ordered);
  const price=body?.ordered_unit_price==null||body.ordered_unit_price===""?null:Number(body.ordered_unit_price);
  if(!/^[0-9a-f-]{36}$/i.test(orderId))return NextResponse.json({ok:false,error:"Choose an order"},{status:400});
  if(!Number.isInteger(qty)||qty<1||qty>1000000)return NextResponse.json({ok:false,error:"Enter a valid whole-number amount actually ordered"},{status:400});
  if(price!==null&&(!Number.isFinite(price)||price<=0||price>10000000))return NextResponse.json({ok:false,error:"Enter a positive price per ordered count unit, or leave it blank"},{status:400});

  const {data:current,error:readError}=await supabaseAdmin.from("order_requests").select("id,status,notes,item_note").eq("id",orderId).single();
  if(readError||!current)return NextResponse.json({ok:false,error:"Order not found"},{status:404});
  if(current.status!=="PENDING")return NextResponse.json({ok:false,error:"Only a Pending request can be marked Ordered"},{status:409});

  const confirmedAt=new Date().toISOString();
  const staff=auth.user.user_metadata?.full_name||auth.user.email||"Ordering staff";
  const update:Record<string,string|number|null>={status:"ORDERED",qty_actual_ordered:qty,ordered_unit_price:price,confirmed_by:staff,confirmed_at:confirmedAt};
  if(current.notes||current.item_note){update.note_acknowledged_by=staff;update.note_acknowledged_at=confirmedAt;}
  const {data:order,error:updateError}=await supabaseAdmin.from("order_requests").update(update).eq("id",orderId).eq("status","PENDING").select("*").maybeSingle();
  if(updateError)throw updateError;
  if(!order)return NextResponse.json({ok:false,error:"This order changed. Refresh and try again."},{status:409});
  return NextResponse.json({ok:true,order});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Could not mark this order as ordered"},{status:500});}
}
