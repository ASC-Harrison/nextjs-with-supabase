// app/api/notify-storage-low-stock/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function parseRecipients(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function moneySafeText(v: unknown) {
  return String(v ?? "").replace(/[<>]/g, "");
}

for (const pair of emailedPairs) {
  await supabase
    .from(TABLE)
    .update({ low_notified: true })
    .eq("storage_area_id", pair.storage_area_id)
    .eq("item_id", pair.item_id);
}

export async function POST(req: Request) {
  try {
    // --- ENV ---
    const apiKey = process.env.RESEND_API_KEY;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Optional: override table/view name if you want
    const TABLE = process.env.STORAGE_LOW_TABLE ?? "storage_inventory";

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }
    const recipients = parseRecipients(toRaw);
    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing LOW_STOCK_EMAIL_TO (or empty)" },
        { status: 500 }
      );
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // --- 1) Pull items that are currently low AND have not been emailed yet ---
    // REQUIRED columns in your table/view:
    // id, item_name, cabinet_name, on_hand, par, is_low, low_email_sent
    const { data: lowRows, error: lowErr } = await supabase
      .from(TABLE)
      .select("id,item_name,cabinet_name,on_hand,par,is_low,low_email_sent")
      .eq("is_low", true)
      .or("low_email_sent.is.null,low_email_sent.eq.false");

    if (lowErr) {
      return NextResponse.json(
        { ok: false, error: `Supabase read error: ${lowErr.message}` },
        { status: 500 }
      );
    }

    const rows = (lowRows ?? []) as LowRow[];
    if (rows.length === 0) {
      // Optional: also reset flags for items that are no longer low (see step 3 below)
      await resetRecoveredFlags(supabase, TABLE);
      return NextResponse.json({ ok: true, sent: false, reason: "No new low items" });
    }

    // --- 2) Group by cabinet and send one email per cabinet ---
    const byCabinet = new Map<string, LowRow[]>();
    for (const r of rows) {
      const cabinet = (r.cabinet_name ?? "Unknown Cabinet").trim() || "Unknown Cabinet";
      if (!byCabinet.has(cabinet)) byCabinet.set(cabinet, []);
      byCabinet.get(cabinet)!.push(r);
    }

    const sentCabinets: string[] = [];
    const emailedItemIds: Array<string | number> = [];

    for (const [cabinet, items] of byCabinet.entries()) {
      items.sort((a, b) => (a.item_name ?? "").localeCompare(b.item_name ?? ""));

      const subject = `LOW STOCK: ${cabinet} (${items.length} item${items.length === 1 ? "" : "s"})`;

      const lines = items
        .map((it) => {
          const name = moneySafeText(it.item_name ?? "Unnamed Item");
          const onHand = it.on_hand ?? 0;
          const par = it.par ?? 0;
          return `• ${name} — On hand: ${onHand} / Par: ${par}`;
        })
        .join("\n");

      const text =
        `Cabinet low-stock alert\n\n` +
        `Cabinet: ${cabinet}\n\n` +
        `Items below par:\n${lines}\n\n` +
        `This alert only sends once per low-stock event. Restocking above par will reset the alert.`;

      // You can also set `from` to your verified Resend domain (recommended).
      // If you don't have one, Resend may require onboarding/verification.
      const from = process.env.LOW_STOCK_EMAIL_FROM ?? "Inventory Alerts <onboarding@resend.dev>";

      const sendRes = await resend.emails.send({
        from,
        to: recipients,
        subject,
        text,
      });

      if ((sendRes as any)?.error) {
        return NextResponse.json(
          { ok: false, error: (sendRes as any).error },
          { status: 500 }
        );
      }

      sentCabinets.push(cabinet);
      for (const it of items) emailedItemIds.push(it.id);
    }

    // --- 3) Mark emailed items so you don't spam ---
    // This sets low_email_sent=true for items we just emailed about.
    const { error: updErr } = await supabase
      .from(TABLE)
      .update({ low_email_sent: true })
      .in("id", emailedItemIds);

    if (updErr) {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase update error (low_email_sent): ${updErr.message}`,
        },
        { status: 500 }
      );
    }

    // --- 4) Reset flags for items that recovered (no longer low) ---
    await resetRecoveredFlags(supabase, TABLE);

    return NextResponse.json({
      ok: true,
      sent: true,
      cabinets: sentCabinets,
      itemsEmailed: emailedItemIds.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

async function resetRecoveredFlags(supabase: any, table: string) {
  // When an item is no longer low, reset low_email_sent so it can alert again next time it goes low.
  // This assumes `is_low` is being computed/maintained elsewhere (your “low flag logic is DONE” step).
  const { error } = await supabase
    .from(table)
    .update({ low_email_sent: false })
    .eq("is_low", false);

  // Don’t hard-fail the route if reset fails (it’s helpful but not critical)
  if (error) {
    console.warn("resetRecoveredFlags warning:", error.message);
  }
}
