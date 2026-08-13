import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true });

    return NextResponse.json({
      ok: !error,
      vapidPrivateConfigured: Boolean(process.env.VAPID_PRIVATE_KEY),
      vapidPublicConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) || true,
      subscriptionsTableReady: !error,
      subscriptionCount: error ? null : (count ?? 0),
      tableError: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      vapidPrivateConfigured: Boolean(process.env.VAPID_PRIVATE_KEY),
      subscriptionsTableReady: false,
      subscriptionCount: null,
      tableError: e?.message ?? "Unknown error",
    });
  }
}
