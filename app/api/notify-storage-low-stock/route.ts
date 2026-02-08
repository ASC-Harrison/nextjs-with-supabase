import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;
    const from =
      process.env.LOW_STOCK_EMAIL_FROM ??
      "Inventory Alerts <onboarding@resend.dev>";

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendApiKey || !toRaw || !supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const recipients = toRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1️⃣ READ from the VIEW (safe)
    const { data, error } = await supabase
      .from("storage_inventory_named")
      .select(
        `
        storage_area_id,
        item_id,
        item_name,
        cabinet_name,
        on_hand,
        par_level,
        low,
        low_notified
      `
      )
      .eq("low", true)
      .or("low_notified.is.null,low_notified.eq.false");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: "No new low items",
      });
    }

    // 2️⃣ Group by cabinet
    const byCabinet = new Map<string, typeof data>();

    for (const row of data) {
      const cabinet = row.cabinet_name ?? "Unknown Location";
      if (!byCabinet.has(cabinet)) byCabinet.set(cabinet, []);
      byCabinet.get(cabinet)!.push(row);
    }

    const emailed: { storage_area_id: string; item_id: string }[] = [];

    // 3️⃣ Send emails
    for (const [cabinet, items] of byCabinet.entries()) {
      const subject = `LOW STOCK: ${cabinet}`;
      const body = items
        .map(
          (i) =>
            `• ${i.item_name} — On hand: ${i.on_hand} / Par: ${i.par_level}`
        )
        .join("\n");

      const send = await resend.emails.send({
        from,
        to: recipients,
        subject,
        text: `Low stock alert for ${cabinet}\n\n${body}`,
      });

      if ((send as any)?.error) {
        return NextResponse.json(
          { error: (send as any).error },
          { status: 500 }
        );
      }

      for (const i of items) {
        emailed.push({
          storage_area_id: i.storage_area_id,
          item_id: i.item_id,
        });
      }
    }

    // 4️⃣ UPDATE BASE TABLE (THIS IS CRITICAL)
    for (const row of emailed) {
      const { error: updErr } = await supabase
        .from("storage_inventory")
        .update({ low_notified: true })
        .eq("storage_area_id", row.storage_area_id)
        .eq("item_id", row.item_id);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      rowsNotified: emailed.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
