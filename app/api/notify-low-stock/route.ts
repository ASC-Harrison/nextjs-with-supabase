// app/api/notify-low-stock/route.ts
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      item_name,
      barcode,
      on_hand,
      par_level,
      location_id,
    } = body ?? {};

    if (!process.env.RESEND_API_KEY) {
      return Response.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!process.env.ALERT_EMAIL_TO) {
      return Response.json({ error: "Missing ALERT_EMAIL_TO" }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const subject = `LOW STOCK: ${item_name ?? "Item"} (${barcode ?? "no barcode"})`;

    const text =
`LOW STOCK ALERT

Item: ${item_name ?? "Unknown"}
Barcode: ${barcode ?? "Unknown"}
Location: ${location_id ?? "Unknown"}
On hand: ${on_hand ?? "?"}
Par level: ${par_level ?? "?"}
`;

    const { error } = await resend.emails.send({
      from: "ASC Inventory <alerts@resend.dev>",
      to: process.env.ALERT_EMAIL_TO,
      subject,
      text,
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

