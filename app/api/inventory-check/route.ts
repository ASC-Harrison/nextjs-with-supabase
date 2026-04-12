import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER!;

const CONTACTS = [
  { email: "hogstud800@gmail.com",          phone: "+18708490998" },
  { email: "brooklyncarter.0716@gmail.com", phone: "+18707546700" },
  { email: "ashelyomsa@gmail.com",          phone: "+18705179045" },
];

async function sendSms(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }).toString(),
  });
  return res.json();
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("building_inventory_sheet_view")
      .select("name,total_on_hand,par_level,low_level,unit")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    const items = data ?? [];

    const alerts = items.filter((r: any) => {
      const oh  = r.total_on_hand ?? 0;
      const low = r.low_level ?? 0;
      return low > 0 && oh <= low;
    });

    if (alerts.length === 0) {
      return NextResponse.json({ ok: true, message: "All items above low level" });
    }

    // Build email HTML
    const rows = alerts.map((r: any) => {
      const name = r.name ?? "";
      const oh   = r.total_on_hand ?? 0;
      const low  = r.low_level ?? 0;
      const par  = r.par_level ?? 0;
      const unit = r.unit ?? "—";
      return "<tr>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;font-weight:600'>" + name + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;color:#dc2626;font-weight:700;text-align:center'>" + oh + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center'>" + unit + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center'>" + low + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center'>" + par + "</td>" +
        "</tr>";
    }).join("");

    const tableHtml =
      "<table style='width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden'>" +
      "<thead><tr style='background:#fee2e2'>" +
      "<th style='padding:10px 12px;text-align:left;color:#dc2626;font-size:11px'>ITEM</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>ON HAND</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>UNIT</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>LOW LEVEL</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>PAR</th>" +
      "</tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "</table>";

    const html =
      "<div style='font-family:sans-serif;max-width:600px;margin:0 auto'>" +
      "<div style='background:#0a0f1e;padding:24px;border-radius:12px 12px 0 0'>" +
      "<h1 style='color:#63b3ed;margin:0;font-size:20px'>Baxter ASC — Inventory Alert</h1>" +
      "<p style='color:#7ba8c8;margin:6px 0 0;font-size:13px'>" + new Date().toLocaleString() + "</p>" +
      "</div>" +
      "<div style='background:#f8fafc;padding:24px;border-radius:0 0 12px 12px'>" +
      "<h2 style='color:#dc2626;margin:0 0 12px;font-size:16px'>" + alerts.length + " Items At or Below Low Level</h2>" +
      tableHtml +
      "<p style='color:#64748b;font-size:12px;margin-top:20px'>Sent automatically by Baxter ASC AI Monitor</p>" +
      "</div>" +
      "</div>";

    const subject =
      "Baxter ASC Alert — " + alerts.length + " items at low level — " + new Date().toLocaleDateString();

    // Build SMS text
    const smsBody =
      "Baxter ASC Alert — " + alerts.length + " item(s) at low level:\n\n" +
      alerts.slice(0, 10).map((r: any) =>
        "• " + (r.name ?? "") + ": " + (r.total_on_hand ?? 0) + " " + (r.unit ?? "") +
        " (low=" + (r.low_level ?? 0) + ")"
      ).join("\n") +
      (alerts.length > 10 ? "\n...and " + (alerts.length - 10) + " more." : "") +
      "\n\nView: https://nextjs-with-supabase-gamma-rosy.vercel.app/alerts";

    // Send email + SMS to all contacts
    const results = await Promise.allSettled([
      ...CONTACTS.map(c =>
        resend.emails.send({
          from: "Baxter ASC Monitor <onboarding@resend.dev>",
          to: [c.email],
          subject,
          html,
        })
      ),
      ...CONTACTS.map(c => sendSms(c.phone, smsBody)),
    ]);

    const failed = results.filter(r => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      message: "Alerts sent for " + alerts.length + " items. " + (failed > 0 ? failed + " failed." : "All delivered."),
    });

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "error" },
      { status: 500 }
    );
  }
}
