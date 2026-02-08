// app/api/notify-storage-low-stock/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/**
 * This version matches YOUR Supabase schema from the screenshot:
 * - public.storage_inventory columns:
 *   storage_area_id (uuid)
 *   item_id (uuid)
 *   on_hand (int4)
 *   par_level (int4)
 *   low (bool)
 *   low_notified (bool)
 *
 * It ALSO expects these joined/display columns to exist in the table OR a view you query:
 *   cabinet_name (or storage_area_name)  <-- used for grouping emails
 *   item_name                           <-- used in the email body
 *
 * If your storage_inventory table does NOT have item_name/cabinet_name,
 * create a VIEW that joins items + storage_areas, and point STORAGE_LOW_TABLE to that view.
 */

function parseRecipients(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safe(v: unknown) {
  return String(v ?? "").replace(/[<>]/g, "");
}

type Row = {
  storage_area_id: string; // uuid
  item_id: string; // uuid
  on_hand: number | null;
  par_level: number | null;
  low: boolean | null;
  low_notified: boolean | null;

  // These are display fields (may come from a view)
  item_name?: string | null;
  cabinet_name?: string | null;
  storage_area_name?: string | null; // fallback if you use this name instead
};

export async function POST(_req: Request) {
  try {
    // ---- ENV ----
    const apiKey = process.env.RESEND_API_KEY;
    const toRaw = process.env.LOW_STOCK_EMAIL_TO;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Table or view name in Supabase:
    // - If you have a VIEW that includes item_name + cabinet_name, set STORAGE_LOW_TABLE to that view name.
    // - Otherwise it will try "storage_inventory".
    const TABLE = process.env.STORAGE_LOW_TABLE ?? "storage_inventory";

    const FROM =
      process.env.LOW_STOCK_EMAIL_FROM ??
      "Inventory Alerts <onboarding@resend.dev>";

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

    // ---- 1) Pull rows that are low AND not yet notified ----
    const selectFields = [
      "storage_area_id",
      "item_id",
      "on_hand",
      "par_level",
      "low",
      "low_notified",
      // display fields (may or may not exist depending on table/view)
      "item_name",
      "cabinet_name",
      "storage_area_name",
    ].join(",");

    const { data, error } = await supabase
      .from(TABLE)
      .select(selectFields)
      .eq("low", true)
      .or("low_notified.is.null,low_notified.eq.false");

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Supabase read error: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as Row[];

    if (rows.length === 0) {
      // reset flags for recovered items (so it can alert again next time it goes low)
      await resetRecoveredFlags(supabase, TABLE);
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: "No new low items",
      });
    }

    // ---- 2) Group by cabinet/storage area (one email per cabinet) ----
    const byCabinet = new Map<string, Row[]>();
    for (const r of rows) {
      const cabinet =
        (r.cabinet_name ??
          r.storage_area_name ??
          "Unknown Storage Area")?.trim() || "Unknown Storage Area";

      if (!byCabinet.has(cabinet)) byCabinet.set(cabinet, []);
      byCabinet.get(cabinet)!.push(r);
    }

    const sentCabinets: string[] = [];
    const emailedPairs: { storage_area_id: string; item_id: string }[] = [];

    for (const [cabinet, items] of byCabinet.entries()) {
      // sort nicely in the email
      items.sort((a, b) =>
        (a.item_name ?? "").localeCompare(b.item_name ?? "")
      );

      const subject = `LOW STOCK: ${cabinet} (${items.length} item${
        items.length === 1 ? "" : "s"
      })`;

      const lines = items
        .map((it) => {
          const name = safe(it.item_name ?? `Item ${it.item_id}`);
          const onHand = it.on_hand ?? 0;
          const par = it.par_level ?? 0;
          return `• ${name} — On hand: ${onHand} / Par: ${par}`;
        })
        .join("\n");

      const text =
        `Cabinet/Storage low-stock alert\n\n` +
        `Location: ${cabinet}\n\n` +
        `Items below par:\n${lines}\n\n` +
        `This alert sends once per low event. Restocking above par will reset the alert.`;

      const sendRes = await resend.emails.send({
        from: FROM,
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
      for (const it of items) {
        emailedPairs.push({
          storage_area_id: it.storage_area_id,
          item_id: it.item_id,
        });
      }
    }

    // ---- 3) Mark notified rows using BOTH keys (storage_area_id + item_id) ----
    // (Avoids needing a single "id" column)
    for (const pair of emailedPairs) {
      const { error: updErr } = await supabase
        .from(TABLE)
        .update({ low_notified: true })
        .eq("storage_area_id", pair.storage_area_id)
        .eq("item_id", pair.item_id);

      if (updErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `Supabase update error (low_notified): ${updErr.message}`,
          },
          { status: 500 }
        );
      }
    }

    // ---- 4) Reset flags for recovered items (low=false => low_notified=false) ----
    await resetRecoveredFlags(supabase, TABLE);

    return NextResponse.json({
      ok: true,
      sent: true,
      cabinets: sentCabinets,
      rowsNotified: emailedPairs.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

async function resetRecoveredFlags(supabase: any, table: string) {
  // If something is no longer low, allow it to email again the next time it becomes low.
  const { error } = await supabase
    .from(table)
    .update({ low_notified: false })
    .eq("low", false);

  if (error) {
    console.warn("resetRecoveredFlags warning:", error.message);
  }
}
