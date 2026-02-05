import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Read the request body ONE time
    const body = await req.json().catch(() => ({}));

    console.log("✅ notify-low-stock HIT");
    console.log("📦 body:", body);

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.LOW_STOCK_EMAIL_TO;
    const from =
      process.env.LOW_STOCK_EMAIL_FROM || "ASC Inventory <onboarding@resend.dev>";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!to) {
      return NextResponse.json({ error: "Missing LOW_STOCK_EMAIL_TO" }, { status: 500 });
    }

    const subject = body?.subject || "Low Stock Alert";
    const html =
      body?.html ||
      `<h2>Low Stock Alert</h2><pre style="font-size:14px">${JSON.stringify(
        body,
        null,
        2
      )}</pre>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("❌ Resend error:", data);
      return NextResponse.json({ error: "Resend error", details: data }, { status: 500 });
    }

    console.log("✅ Email sent:", data);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.log("❌ notify-low-stock crashed:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

