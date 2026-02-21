export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };

  const apiKey = process.env.RESEND_API_KEY;
  const toRaw = process.env.LOW_STOCK_EMAIL_TO;

  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500, headers });
  if (!toRaw) return NextResponse.json({ ok: false, error: "Missing LOW_STOCK_EMAIL_TO" }, { status: 500, headers });

  const { area_id } = await req.json().catch(() => ({}));
  const to = toRaw.split(",").map((s) => s.trim()).filter(Boolean);

  let q = supabaseAdmin
    .from("storage_inventory")
    .select(
      `
      item_id,
      area_id,
      on_hand,
      par_level,
      low_notified,
      items:item_id ( id, name, barcode ),
      storage_areas:area_id ( id, name )
    `
    )
    .gt("par_level", 0);

  if (area_id) q = q.eq("area_id", area_id);

  const { data, error } = await q;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });

  const lowRows = (data ?? []).filter((r: any) => Number(r.on_hand ?? 0) < Number(r.par_level ?? 0));

  if (lowRows.length === 0) {
    return NextResponse.json({ ok: true, sent: false, message: "No low stock rows." }, { headers });
  }

  const subject = area_id ? `LOW STOCK (Area)` : `LOW STOCK (All Areas)`;

  const lines = lowRows.map((r: any) => {
    const area = r.storage_areas?.name ?? "Unknown Area";
    const name = r.items?.name ?? "Unknown Item";
    const barcode = r.items?.barcode ?? "";
    const on_hand = Number(r.on_hand ?? 0);
    const par = Number(r.par_level ?? 0);
    const flagged = r.low_notified ? " (already notified)" : "";
    return `${area} | ${name} | on_hand ${on_hand} / par ${par}${barcode ? ` | ${barcode}` : ""}${flagged}`;
  });

  const html =
    `<div style="font-family:Arial,sans-serif">
      <h2>${subject}</h2>
      <p>Items currently below par:</p>
      <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${lines.join("\n")}</pre>
    </div>`;

  // Send using Resend REST
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Baxter ASC Inventory <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `Resend failed: ${resp.status} ${txt}` }, { status: 500, headers });
  }

  // Mark notified
  const updates = lowRows.map((r: any) => ({
    item_id: r.item_id,
    area_id: r.area_id,
    low_notified: true,
  }));

  const { error: upErr } = await supabaseAdmin
    .from("storage_inventory")
    .upsert(updates, { onConflict: "item_id,area_id" });

  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500, headers });

  return NextResponse.json({ ok: true, sent: true, count: lowRows.length }, { headers });
}
