import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = ["admin", "staff", "preop"];

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) {
      return NextResponse.json({ ok: false, error: "Staff access required" }, { status: 403 });
    }

    const { subscription, staff_name } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: "Invalid push subscription" }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    if (deleteError) throw deleteError;

    const fallbackName =
      authData.user.user_metadata?.full_name?.trim() ||
      authData.user.email ||
      "Staff";
    const staffName =
      typeof staff_name === "string" && staff_name.trim()
        ? staff_name.trim().slice(0, 120)
        : fallbackName;

    const { error: insertError } = await supabaseAdmin
      .from("push_subscriptions")
      .insert({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        staff_name: staffName,
        user_id: authData.user.id,
        updated_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Unable to save push subscription:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, error: "Unable to save push subscription" },
      { status: 500 }
    );
  }
}
