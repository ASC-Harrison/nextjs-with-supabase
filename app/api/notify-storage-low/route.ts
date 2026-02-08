import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function parseRecipients(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function handler() {
  const resend = new Resend(assertEnv("RESEND_API_KEY"));

  const supabase = createClient(
    assertEnv("NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const from = assertEnv("LOW_STOCK_EMAIL_FROM"); // e.g. alerts@ascinventory.com
  const to = parseRecipients(process.env.LOW_STOCK_EMAIL_TO);

  if (to.length === 0) throw new Error("LOW_STOCK_EMAIL_TO is empty");

  // Pull cabinet rows that are low AND not yet notified
  const { data: rows, error } = await supabase
    .from("storage_inventory")
    .select("storage_area_id, item_id, on_hand, par_level")
    .eq("low", true)
    .eq("low_notified", false);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    return Response.json({ ok: true, message: "No new cabinet low stock rows." });
  }

  // Get item names
  const itemIds = [...new Set(rows.map((r: any) => r.item_id))];
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id, name, barcode")
    .in("id", itemIds);
  if (itemsErr) throw itemsErr;
  const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));

  // Get storage area names + parent location names
  const areaIds = [...new Set(rows.map((r: any) => r.storage_area_id))];
  const { data: areas, error: areasErr } = await supabase
    .from("storage_areas")
    .select("id, name, location_id")
    .in("id", areaIds);
  if (areasErr) throw areasErr;

  const locationIds = [...new Set((areas ?? []).map((a: any) => a.location_id))];
  const { data: locations, error: locErr } = await supabase
    .from("locations")
    .select("id, name")
    .in("id", locationIds);
  if (locErr) throw locErr;

  const locMap = new Map((locations ?? []).map((l: any) => [l.id, l.name]));
  const areaLabelMap = new Map(
    (areas ?? []).map((a: any) => [
      a.id,
      `${locMap.get(a.location_id) ?? a.location_id} — ${a.name}`,
    ])
  );

  const html = `
    <h2>Cabinet Low Stock Alert</h2>
    <p>${rows.length} cabinet item(s) are low:</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Item</th><th>Barcode</th><th>Cabinet</th><th>On Hand</th><th>Par</th></tr>
      ${rows
        .map((r: any) => {
          const it = itemMap.get(r.item_id);
          const cabinet = areaLabelMap.get(r.storage_area_id) ?? r.storage_area_id;
          return `<tr>
            <td>${it?.name ?? r.item_id}</td>
            <td>${it?.barcode ?? ""}</td>
            <td>${cabinet}</td>
            <td>${r.on_hand}</td>
            <td>${r.par_level ?? ""}</td>
          </tr>`;
        })
        .join("")}
    </table>
  `;

  const sendResult = await resend.emails.send({
    from,
    to, // ARRAY
    subject: `ASC Cabinet Low Stock (${rows.length})`,
    html,
  });

  // Mark notified only if send succeeded
  if ((sendResult as any)?.error) {
    return Response.json(
      { ok: false, resend_error: (sendResult as any).error },
      { status: 500 }
    );
  }

  // composite key update
  for (const r of rows as any[]) {
    const { error: updErr } = await supabase
      .from("storage_inventory")
      .update({ low_notified: true })
      .eq("storage_area_id", r.storage_area_id)
      .eq("item_id", r.item_id);
    if (updErr) throw updErr;
  }

  return Response.json({ ok: true, emailed: rows.length, to });
}

export async function POST() {
  try {
    return await handler();
  } catch (err: any) {
    console.error("notify-storage-low-stock error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
