import { Resend } from "resend";

function parseRecipients(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST() {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.LOW_STOCK_EMAIL_FROM;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;

    const to = parseRecipients(toRaw);

    if (!resendKey) {
      return Response.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!from) {
      return Response.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_FROM" }, { status: 500 });
    }
    if (to.length === 0) {
      return Response.json({ ok: false, error: "Missing/empty LOW_STOCK_EMAIL_TO" }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    console.log("TEST EMAIL → from:", from, "to:", to);

    const result = await resend.emails.send({
      from,
      to, // ✅ ARRAY
      subject: "ASC Inventory: Test Email ✅",
      html: `<p>This is a test email from ASC Inventory Live.</p>`,
    });

    console.log("Resend send result:", result);

    // If Resend returns { error: ... } we surface it
    // (different versions return slightly different shapes)
    // @ts-ignore
    if (result?.error) {
      // @ts-ignore
      return Response.json({ ok: false, resend_error: result.error, to }, { status: 500 });
    }

    return Response.json({ ok: true, to, result });
  } catch (err: any) {
    console.error("test-email error:", err);
    return Response.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
