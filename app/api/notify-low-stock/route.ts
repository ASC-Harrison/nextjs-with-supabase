import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    // Don’t crash if the request has no JSON body
    let body: any = null;
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.TEST_EMAIL_TO;

    if (!apiKey) {
      return Response.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to) {
      return Response.json({ ok: false, error: "Missing TEST_EMAIL_TO" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: "Inventory Alerts <onboarding@resend.dev>", // works for testing
      to,
      subject: "Low stock test",
      html: `<p>Test email worked.</p><pre>${JSON.stringify(body, null, 2)}</pre>`,
    });

    return Response.json({ ok: true, result });
  } catch (err: any) {
    console.error("notify-low-stock error:", err);
    return Response.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
