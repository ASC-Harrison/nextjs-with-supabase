import { Resend } from "resend";

export async function POST() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);

    await resend.emails.send({
      from: process.env.LOW_STOCK_EMAIL_FROM!,
      to: process.env.LOW_STOCK_EMAIL_TO!,
      subject: "ASC Inventory Test Email ✅",
      html: "<p>Your test email worked.</p>",
    });

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("test-email error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
