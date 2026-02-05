import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("notify-low-stock: hit POST");

  try {
    // SAFELY read body (won’t crash if empty)
    let body: any = null;
    const text = await req.text();
    if (text) body = JSON.parse(text);

    console.log("notify-low-stock: body =", body);

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.TEST_EMAIL_TO;

    if (!apiKey) throw new Error("Missing RESEND_API_KEY in Vercel env vars");
    if (!to) throw new Error("Missing TEST_EMAIL_TO in Vercel env vars");

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: "Inventory Alerts <onboarding@resend.dev>",
      to,
      subject: "Low stock test",
      html: "<p>Test email from /api/notify-low-stock</p>",
    });

    console.log("notify-low-stock: resend result =", result);

    return Response.json({ ok: true, result });
  } catch (err: any) {
    console.error("notify-low-stock ERROR:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
