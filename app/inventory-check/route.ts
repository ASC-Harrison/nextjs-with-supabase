
Copy

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
 
const resend = new Resend(process.env.RESEND_API_KEY);
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
const ALERT_TO = "hogstud800@gmail.com";
 
export async function GET(req: Request) {
  try {
    // Load inventory from view
    const { data: inventory, error } = await supabase
      .from("building_inventory_sheet_view")
      .select("item_id,name,total_on_hand,par_level,low_level,unit,order_status,backordered")
      .eq("is_active", true)
      .order("name", { ascending: true });
 
    if (error) throw error;
    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ ok: true, message: "No inventory data" });
    }
 
    const critical = inventory.filter((r: any) => {
      const oh  = r.total_on_hand ?? 0;
      const low = r.low_level ?? 0;
      return low > 0 && oh <= low;
    });
    const low      = inventory.filter((r: any) => {
      const oh  = r.total_on_hand ?? 0;
      const par = r.par_level ?? 0;
      const low = r.low_level ?? 0;
      // Below par but still above low level — worth mentioning but not critical
      return oh > low && par > 0 && oh < par;
    });
 
    // Only send alert email if there are critical or low items
    if (critical.length === 0 && low.length === 0) {
      return NextResponse.json({ ok: true, message: "All items well stocked — no alert needed" });
    }
 
    const criticalRows = critical.map((r: any) => {
      const pct = r.par_level > 0 ? Math.round((r.total_on_hand / r.par_level) * 100) : 0;
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;font-weight:600">${r.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;color:#dc2626;font-weight:700;text-align:center">${r.total_on_hand ?? 0}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center">${r.low_level ?? 0}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center">${r.par_level ?? 0}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;text-align:center">
          <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px">AT LOW LEVEL</span>
        </td>
      </tr>`}).join("");
 
    const lowRows = low.map((r: any) => {
      const pct = r.par_level > 0 ? Math.round((r.total_on_hand / r.par_level) * 100) : 0;
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;font-weight:600">${r.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;color:#d97706;font-weight:700;text-align:center">${r.total_on_hand}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;text-align:center">${r.par_level}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;text-align:center">
          <span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:4px;font-size:12px">LOW ${pct}%</span>
        </td>
      </tr>`;
    }).join("");
 
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0a0f1e;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:#63b3ed;margin:0;font-size:20px">⚕️ Baxter ASC — Automatic Inventory Alert</h1>
          <p style="color:#7ba8c8;margin:6px 0 0;font-size:13px">Auto-generated · ${new Date().toLocaleString()}</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px">
 
          ${critical.length ? `
          <h2 style="color:#dc2626;margin:0 0 12px;font-size:16px">🔴 ${critical.length} Items at or Below Low Level</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
            <thead>
              <tr style="background:#fee2e2">
                <th style="padding:10px 12px;text-align:left;color:#dc2626;font-size:12px">ITEM</th>
                <th style="padding:10px 12px;text-align:center;color:#dc2626;font-size:12px">ON HAND</th>
                <th style="padding:10px 12px;text-align:center;color:#dc2626;font-size:12px">LOW LEVEL</th>
                <th style="padding:10px 12px;text-align:center;color:#dc2626;font-size:12px">PAR</th>
                <th style="padding:10px 12px;text-align:center;color:#dc2626;font-size:12px">STATUS</th>
              </tr>
            </thead>
            <tbody>${criticalRows}</tbody>
          </table>` : ""}
 
          ${low.length ? `
          <h2 style="color:#d97706;margin:0 0 12px;font-size:16px">🟡 ${low.length} Items Below Par</h2>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
            <thead>
              <tr style="background:#fef3c7">
                <th style="padding:10px 12px;text-align:left;color:#d97706;font-size:12px">ITEM</th>
                <th style="padding:10px 12px;text-align:center;color:#d97706;font-size:12px">ON HAND</th>
                <th style="padding:10px 12px;text-align:center;color:#d97706;font-size:12px">PAR</th>
                <th style="padding:10px 12px;text-align:center;color:#d97706;font-size:12px">STATUS</th>
              </tr>
            </thead>
            <tbody>${lowRows}</tbody>
          </table>` : ""}
 
          <p style="color:#64748b;font-size:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            Automatically sent by Baxter ASC AI Monitor ·
            <a href="https://nextjs-with-supabase-gamma-rosy.vercel.app/asc-ai-monitor%20(1).html" style="color:#63b3ed">Open Monitor</a>
          </p>
        </div>
      </div>`;
 
    await resend.emails.send({
      from: "Baxter ASC Monitor <onboarding@resend.dev>",
      to: [ALERT_TO],
      subject: `🚨 Baxter ASC Alert — ${critical.length} At Low Level, ${low.length} Below Par · ${new Date().toLocaleDateString()}`,
      html,
    });
 
    return NextResponse.json({
      ok: true,
      message: `Alert sent — ${critical.length} critical, ${low.length} low`,
    });
 
  } catch (e: any) {
    console.error("Inventory check failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
