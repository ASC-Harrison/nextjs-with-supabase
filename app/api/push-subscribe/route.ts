import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { subscription, staff_name } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: "Invalid push subscription" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      staff_name: staff_name || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unable to save push subscription" }, { status: 500 });
  }
}
