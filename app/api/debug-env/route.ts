import { NextResponse } from "next/server";

function projectRefFromUrl(url?: string) {
  if (!url) return null;
  // matches: https://PROJECTREF.supabase.co
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = projectRefFromUrl(supabaseUrl);

  return NextResponse.json({
    ok: true,
    supabaseUrl,
    projectRef,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    lowStockToSet: Boolean(process.env.LOW_STOCK_EMAIL_TO),
  });
}
