import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const resend    = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CONTACTS = [
  { email: "hogstud800@gmail.com" },
  { email: "brooklyncarter.0716@gmail.com" },
  { email: "ashelyomsa@gmail.com" },
];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("building_inventory_sheet_view")
      .select("name,reference_number,total_on_hand,par_level,low_level,unit")
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
      return NextResponse.json({ ok: true, message: "All items above low level — no alert needed" });
    }

    // Ask AI if this is critical enough to send an alert
    const aiPrompt =
      "You are monitoring inventory for Baxter ASC (Ambulatory Surgery Center). " +
      "Here are the items currently at or below their low level threshold:\n\n" +
      alerts.map((r: any) =>
        "- " + (r.name ?? "") + " (Ref: " + (r.reference_number ?? "—") + "): " +
        (r.total_on_hand ?? 0) + " " + (r.unit ?? "") + " on hand, " +
        "low level=" + (r.low_level ?? 0) + ", par=" + (r.par_level ?? 0)
      ).join("\n") +
      "\n\nShould an alert be sent to the team right now? " +
      "Consider: are any of these surgical supplies that could affect patient care? " +
      "Are multiple critical items low at the same time? " +
      "Reply with exactly one word: YES or NO. " +
      "Then on a new line write a brief 1-2 sentence reason.";

    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{ role: "user", content: aiPrompt }],
    });

    const aiText = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "YES";
    const shouldAlert = aiText.trim().toUpperCase().startsWith("YES");
    const aiReason = aiText.split("\n").slice(1).join(" ").trim();

    if (!shouldAlert) {
      return NextResponse.json({
        ok: true,
        message: "AI decided no alert needed. Reason: " + aiReason,
        items_low: alerts.length,
      });
    }

    // Build email HTML
    const rows = alerts.map((r: any) => {
      const name = r.name ?? "";
      const ref  = r.reference_number ?? "—";
      const oh   = r.total_on_hand ?? 0;
      const low  = r.low_level ?? 0;
      const par  = r.par_level ?? 0;
      const unit = r.unit ?? "—";
      return "<tr>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;font-weight:600'>" + name + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;font-family:monospace;font-size:11px'>" + ref + "</td>" +
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
      "<th style='padding:10px 12px;text-align:left;color:#dc2626;font-size:11px'>REF #</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>ON HAND</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>UNIT</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>LOW LEVEL</th>" +
      "<th style='padding:10px 12px;text-align:center;color:#dc2626;font-size:11px'>PAR</th>" +
      "</tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "</table>";

    const html =
      "<div style='font-family:sans-serif;max-width:620px;margin:0 auto'>" +
      "<div style='background:#0a0f1e;padding:24px;border-radius:12px 12px 0 0'>" +
      "<h1 style='color:#63b3ed;margin:0;font-size:20px'>⚕️ Baxter ASC — AI Inventory Alert</h1>" +
      "<p style='color:#7ba8c8;margin:6px 0 0;font-size:13px'>" + new Date().toLocaleString() + "</p>" +
      "</div>" +
      "<div style='background:#f8fafc;padding:24px;border-radius:0 0 12px 12px'>" +
      "<div style='background:#fff8e1;border:1px solid #f6ad55;border-radius:8px;padding:12px 16px;margin-bottom:18px'>" +
      "<div style='font-size:12px;font-weight:700;color:#d97706;margin-bottom:4px'>🤖 AI Analysis</div>" +
      "<div style='font-size:13px;color:#334155'>" + (aiReason || "Items require immediate attention.") + "</div>" +
      "</div>" +
      "<h2 style='color:#dc2626;margin:0 0 12px;font-size:16px'>" + alerts.length + " Items At or Below Low Level</h2>" +
      tableHtml +
      "<p style='color:#64748b;font-size:12px;margin-top:20px'>" +
      "Sent automatically by Baxter ASC AI Monitor · " +
      "<a href='https://nextjs-with-supabase-gamma-rosy.vercel.app/alerts' style='color:#63b3ed'>View Alerts Page</a>" +
      "</p>" +
      "</div>" +
      "</div>";

    const subject =
      "🤖 Baxter ASC AI Alert — " + alerts.length + " items at low level — " +
      new Date().toLocaleDateString();

    // Send to all contacts
    await Promise.allSettled(
      CONTACTS.map(c =>
        resend.emails.send({
          from: "Baxter ASC Monitor <alerts@ascinventory.com>",
          to: [c.email],
          subject,
          html,
        })
      )
    );

    return NextResponse.json({
      ok: true,
      message: "AI approved alert — sent to " + CONTACTS.length + " contacts for " + alerts.length + " items.",
      ai_reason: aiReason,
    });

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "error" },
      { status: 500 }
    );
  }
}


export async function GET() {
  try {
    const { data, error } = await supabase
      .from("building_inventory_sheet_view")
      .select("name,reference_number,total_on_hand,par_level,low_level,unit")
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
      const ref  = r.reference_number ?? "—";
      const oh   = r.total_on_hand ?? 0;
      const low  = r.low_level ?? 0;
      const par  = r.par_level ?? 0;
      const unit = r.unit ?? "—";
      return "<tr>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;font-weight:600'>" + name + "</td>" +
        "<td style='padding:8px 12px;border-bottom:1px solid #fee2e2;font-family:monospace;font-size:11px'>" + ref + "</td>" +
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
      "<th style='padding:10px 12px;text-align:left;color:#dc2626;font-size:11px'>REF #</th>" +
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
          from: "Baxter ASC Monitor <alerts@ascinventory.com>",
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
