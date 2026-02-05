import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Read JSON ONE time only
    const body = await req.json();

    const to = process.env.LOW_STOCK_EMAIL_TO;
    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.LOW_STOCK_EMAIL_FROM || "ASC Inventory <onboarding@resend.dev>";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to) {
      return NextResponse.json({ error: "Missing LOW_STOCK_EMAIL_TO" }, { status: 500 });
    }

    const subject = body?.subject ?? "Low Stock Alert";
    const html =
      body?.html ??
      `<h2>Low Stock Alert</h2>
       <pre style="font-size:14px">${JSON.stringify(body, null, 2)}</pre>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const data = await resendResp.json();

    if (!resendResp.ok) {
      return NextResponse.json(
        { error: "Resend error", status: resendResp.status, details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
