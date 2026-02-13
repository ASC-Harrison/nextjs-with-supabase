import { NextResponse } from "next/server";

function projectRefFromUrl(url?: string) {
  if (!url) return null;
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
    hasLowStockTo: Boolean(process.env.LOW_STOCK_EMAIL_TO),
  });
}
