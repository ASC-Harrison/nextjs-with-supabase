import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Middleware authenticates the bearer token and overwrites this ID.
    const userId = request.headers.get("x-asc-user-id");
    if (!userId) return NextResponse.json({ok:false,error:"Sign in to sync your order list."},{status:401});
    const {data:role,error:roleError}=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",userId).maybeSingle();
    if(roleError)throw roleError;
    if(!role||!["admin","staff"].includes(role.role))return NextResponse.json({ok:false,error:"Ordering access required."},{status:403});
    const text=await request.text();
    if(text.length>1_000_000)return NextResponse.json({ok:false,error:"Draft update is too large."},{status:413});
    const body=JSON.parse(text);
    if(!Array.isArray(body.operations)||body.operations.length>100)return NextResponse.json({ok:false,error:"Invalid draft update."},{status:400});
    for(const op of body.operations){
      if(!op||typeof op.id!=="string"||!["import","patch","remove","ack"].includes(op.kind)||!Array.isArray(op.changes)||op.changes.length>2000)
        return NextResponse.json({ok:false,error:"Invalid draft operation."},{status:400});
    }
    // One database row lock serializes devices; operation IDs make retries safe.
    const {data,error}=await supabaseAdmin.rpc("sync_order_draft",{p_user_id:userId,p_operations:body.operations});
    if(error)throw error;
    return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("[order-draft-sync]",error instanceof Error?error.message:"Draft sync failed");
    return NextResponse.json({ok:false,error:"Order draft could not sync. Your device copy is preserved; retry when online."},{status:503});
  }
}
