import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.LOW_STOCK_EMAIL_TO;
    const from = process.env.LOW_STOCK_EMAIL_FROM;

    if (!apiKey) {
      return Response.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to) {
      return Response.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_TO" }, { status: 500 });
    }
    if (!from) {
      return Response.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_FROM" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,                 // uses your env var
      to,                   // uses your env var
      subject: "Low Stock Alert (Test)",
      html: `
        <h2>Low Stock Alert</h2>
        <p>This is a test email confirming Resend works.</p>
        <p>If you received this, your setup is correct.</p>
      `,
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
