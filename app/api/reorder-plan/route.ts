import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadReorderPlan } from "@/lib/load-reorder-plan";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ok: false, error: "Sign in required"}, {status: 401});
    const {data, error} = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ok: false, error: "Invalid session"}, {status: 401});
    const role = await supabaseAdmin.from("app_user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "staff", "preop"]).limit(1).maybeSingle();
    if (role.error || !role.data) return NextResponse.json({ok: false, error: "Staff access required"}, {status: 403});
    return NextResponse.json({ok: true, ...await loadReorderPlan()}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    console.error("Reorder plan failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ok: false, error: "Could not load the reorder plan. Refresh to try again."}, {status: 500});
  }
}
