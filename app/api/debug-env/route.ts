export async function GET() {
  // Do NOT print secret values. Just true/false.
  return Response.json({
    ok: true,
    has_RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    has_LOW_STOCK_EMAIL_TO: !!process.env.LOW_STOCK_EMAIL_TO,
    has_LOW_STOCK_EMAIL_FROM: !!process.env.LOW_STOCK_EMAIL_FROM,
    node_env: process.env.NODE_ENV ?? null,
  });
}
