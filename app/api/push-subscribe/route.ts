import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { subscription, staff_name } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: "Invalid push subscription" }, { status: 400 });
    }

    // Keep this compatible with the existing production table. It only
    // requires the three fields used when sending a push notification and
    // does not depend on optional columns or a unique endpoint constraint.
    const { error: deleteError } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabaseAdmin
      .from("push_subscriptions")
      .insert({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });

    if (insertError) throw insertError;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unable to save push subscription" }, { status: 500 });
  }
}
