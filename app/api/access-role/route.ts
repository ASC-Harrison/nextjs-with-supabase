import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const userId = request.headers.get("x-asc-user-id");
  if (!userId) {
    return NextResponse.json({ ok:false, error:"Authentication required" }, { status:401 });
  }

  const { data, error } = await supabaseAdmin
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok:false, error:"Could not verify app access" }, { status:500 });
  }
  if (!data?.role) {
    return NextResponse.json({ ok:false, error:"Registered app access required" }, { status:403 });
  }

  return NextResponse.json({
    ok:true,
    role:data.role,
    message_only:data.role === "brooklyn_messages",
  });
}
