// app/api/notify-storage-low-stock/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/**
 * Matches your schema:
 * public.storage_inventory
 * - storage_area_id (uuid)
 * - item_id (uuid)
 * - on_hand (int4)
 * - par_level (int4)
 * - low (bool)
 * - low_notified (bool)
 *
 * This route assumes you are querying a VIEW that also exposes:
 * - item_name
 * - cabinet_name (or storage_area_name)
 *
 * If those do not exist, set STORAGE_LOW_TABLE to a view name that joins them.
 */

type InventoryRow = {
  storage_area_id: string;
  item_id: string;
  on_hand: number | null;
  par_level: number | null;
  low: boolean | null;
  low_notified: boolean | null;
  item_name?: string | null;
  cabinet_name?: string | null;
  storage_area_name?: string | null;
};

function parseRecipients(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safe(v: unknown) {
  return String(v ?? "").replace(/[<>]/g, "");
}

export async function POST() {
  try {
    // ---- ENV ----
    const apiKey = process.env.RESEND_API_KEY;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const TABLE = process.env.STORAGE_LOW_TABLE ?? "storage_inventory";
    const FROM =
      process.env.LOW_STOCK_EMAIL_FROM ??
      "Inventory Alerts <onboarding@resend.dev>";

    if (!apiKey || !toRaw || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing required environment variables" },
        { status: 500 }
      );
    }

    const recipients = parseRecipients(toRaw);
    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "LOW_STOCK_EMAIL_TO is empty" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ---- FETCH LOW + NOT NOTIFIED ----
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        storage_area_id,
        item_id,
        on_hand,
        par_level,
        low,
        low_notified,
        item_name,
        cabinet_name,
        storage_area_name
      `)
      .eq("low", true)
      .or("low_notified.is.null,low_notified.eq.false");

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows: InventoryRow[] = data ?? [];

    if (rows.length === 0) {
      // reset recovered items
      await supabase
        .from(TABLE)
        .update({ low_notified: false })
        .eq("low", false);

      return NextResponse.json({
        ok: true,
        sent: false,
        reason: "No new low items",
      });
    }

    // ---- GROUP BY CABINET ----
    const byCabinet = new Map<string, InventoryRow[]>();

    for (const row of rows) {
      const cabinet =
        row.cabinet_name ??
        row.storage_area_name ??
        "Unknown Storage Area";

      if (!byCabinet.has(cabinet)) {
        byCabinet.set(cabinet, []);
      }
      byCabinet.get(cabinet)!.push(row);
    }

    const emailedPairs: {
      storage_area_id: string;
      item_id: string;
    }[] = [];

    const sentCabinets: string[] = [];

    // ---- SEND EMAILS ----
    for (const [cabinet, items] of byCabinet.entries()) {
      items.sort((a, b) =>
        (a.item_name ?? "").localeCompare(b.item_name ?? "")
      );

      const subject = `LOW STOCK: ${cabinet}`;

      const body = items
        .map((i) => {
          return `• ${safe(i.item_name ?? i.item_id)}
  On hand: ${i.on_hand ?? 0}
  Par: ${i.par_level ?? 0}`;
        })
        .join("\n\n");

      await resend.emails.send({
        from: FROM,
        to: recipients,
        subject,
        text: `Low stock alert for ${cabinet}\n\n${body}`,
      });

      sentCabinets.push(cabinet);

      for (const i of items) {
        emailedPairs.push({
          storage_area_id: i.storage_area_id,
          item_id: i.item_id,
        });
      }
    }

    // ---- MARK NOTIFIED ----
    for (const pair of emailedPairs) {
      await supabase
        .from(TABLE)
        .update({ low_notified: true })
        .eq("storage_area_id", pair.storage_area_id)
        .eq("item_id", pair.item_id);
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      cabinets: sentCabinets,
      rowsNotified: emailedPairs.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
