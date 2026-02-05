"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LocationRow = {
  id: string;
  name: string;
};

type ScanType = "IN" | "OUT";

type InventoryRow = {
  id: string;
  barcode: string | null;
  location_id: string;
  item_id: string | null;
  product_id: string | null;
  on_hand: number | null;
  low_stock: boolean | null;
  status: string | null;
  par_level?: number | null; // optional if you ALSO store it on inventory
};

type ItemRow = {
  id: string;
  item_name: string | null;
  par_level: number | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [scanType, setScanType] = useState<ScanType>("OUT");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("1");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const amount = useMemo(() => {
    const n = parseInt(qty || "1", 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [qty]);

  // Load locations on page load
  useEffect(() => {
    (async () => {
      setErr("");
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");

      if (error) {
        setErr(error.message);
        return;
      }

      const rows = (data || []) as LocationRow[];
      setLocations(rows);
      if (!locationId && rows.length) setLocationId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function notifyLowStock(payload: {
    subject: string;
    html: string;
  }) {
    // This hits your Next.js API route: app/api/notify-low-stock/route.ts
    const res = await fetch("/api/notify-low-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // don't crash the scan; just surface it
      const t = await res.text().catch(() => "");
      throw new Error(`Notify failed: ${res.status} ${t}`);
    }
  }

  async function submitScan() {
    setErr("");
    setMsg("");

    const cleanBarcode = barcode.trim();
    if (!locationId) {
      setErr("Location is required");
      return;
    }
    if (!cleanBarcode) {
      setErr("Barcode is required");
      return;
    }

    setBusy(true);

    try {
      // 1) Find inventory row (NO joins so it works regardless of FK naming)
      const { data: inv, error: invErr } = await supabase
        .from("inventory")
        .select(
          "id, barcode, location_id, item_id, product_id, on_hand, low_stock, status, par_level"
        )
        .eq("barcode", cleanBarcode)
        .eq("location_id", locationId)
        .single();

      if (invErr || !inv) {
        throw new Error("Item not found for this barcode + location");
      }

      const invRow = inv as InventoryRow;

      // 2) Pull par_level + item_name from items table
      //    Works whether your inventory uses product_id OR item_id
      const itemLookupId = invRow.product_id ?? invRow.item_id ?? null;

      let itemName = "Item";
      let par = 0;

      // If you store par_level on inventory, use it as a fallback
      const invPar = Number(invRow.par_level ?? 0);

      if (itemLookupId) {
        const { data: item, error: itemErr } = await supabase
          .from("items")
          .select("id, item_name, par_level")
          .eq("id", itemLookupId)
          .single();

        if (!itemErr && item) {
          const itemRow = item as ItemRow;
          itemName = itemRow.item_name || itemName;
          par = Number(itemRow.par_level ?? 0);
        } else {
          // if items lookup fails, fall back to inventory par_level if present
          par = invPar;
        }
      } else {
        par = invPar;
      }

      const currentOnHand = Number(invRow.on_hand ?? 0);

      // 3) Calculate new qty
      const newQty =
        scanType === "OUT"
          ? Math.max(0, currentOnHand - amount)
          : currentOnHand + amount;

      // 4) Decide low_stock
      // If par is 0/blank, we treat it as "not low" (otherwise everything becomes low)
      const low = par > 0 ? newQty <= par : false;

      // only notify when it flips false -> true
      const flippedToLow = !Boolean(invRow.low_stock) && low;

      // 5) Update inventory row
      const { error: upErr } = await supabase
        .from("inventory")
        .update({
          on_hand: newQty,
          low_stock: low,
          status: low ? "LOW" : "OK",
        })
        .eq("id", invRow.id);

      if (upErr) throw upErr;

      // 6) Notify (email) ONLY when it flips to low
      if (flippedToLow) {
        await notifyLowStock({
          subject: "Low Stock Alert",
          html: `
            <h2>LOW STOCK</h2>
            <p><b>${itemName}</b></p>
            <p>Barcode: <b>${cleanBarcode}</b></p>
            <p>New qty: <b>${newQty}</b></p>
            <p>Par level: <b>${par}</b></p>
            <p>Location ID: <b>${locationId}</b></p>
          `,
        });
      }

      setMsg(
        `${scanType} OK — ${itemName}: ${currentOnHand} → ${newQty} ${
          low ? "(LOW)" : ""
        } ${flippedToLow ? " — alert sent" : ""}`
      );

      // reset fields for faster scanning
      setBarcode("");
      setQty("1");
    } catch (e: any) {
      setErr(e?.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-5 shadow-sm">
        <h1 className="text-xl font-semibold">ASC Inventory Live</h1>
        <p className="text-sm opacity-70 mb-4">
          Scan IN / OUT updates on-hand. LOW clears when restocked.
        </p>

        <label className="text-sm font-medium">Location</label>
        <select
          className="w-full mt-1 mb-4 rounded-md border px-3 py-2"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={busy}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium">Scan Type</label>
        <div className="mt-1 mb-4 flex gap-2">
          <button
            className={`flex-1 rounded-md border px-3 py-2 ${
              scanType === "OUT" ? "font-semibold" : "opacity-70"
            }`}
            onClick={() => setScanType("OUT")}
            disabled={busy}
            type="button"
          >
            OUT (use)
          </button>
          <button
            className={`flex-1 rounded-md border px-3 py-2 ${
              scanType === "IN" ? "font-semibold" : "opacity-70"
            }`}
            onClick={() => setScanType("IN")}
            disabled={busy}
            type="button"
          >
            IN (restock)
          </button>
        </div>

        <label className="text-sm font-medium">Barcode</label>
        <input
          className="w-full mt-1 mb-4 rounded-md border px-3 py-2"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or type barcode"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitScan();
          }}
        />

        <label className="text-sm font-medium">Qty</label>
        <input
          className="w-full mt-1 mb-4 rounded-md border px-3 py-2"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitScan();
          }}
        />

        <button
          className="w-full rounded-md border px-3 py-2 font-semibold"
          onClick={submitScan}
          disabled={busy}
          type="button"
        >
          {busy ? "Working..." : "Submit Scan"}
        </button>
<button
  type="button"
  onClick={submitScan}
  disabled={busy}
>
  {busy ? "Working..." : "Submit Scan"}
</button>

<button
  type="button"
  onClick={async () => {
    const res = await fetch("/api/notify-low-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "TEST EMAIL",
        html: "<h2>✅ Test email sent</h2><p>If you got this, email works.</p>",
      }),
    });

    alert("Email test status: " + res.status);
  }}
  style={{
    marginTop: "10px",
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #999",
  }}
>
  Send Test Email
</button>

        {err ? (
          <p className="mt-3 text-sm text-red-600 whitespace-pre-wrap">{err}</p>
        ) : null}
        {msg ? (
          <p className="mt-3 text-sm text-green-700 whitespace-pre-wrap">
            {msg}
          </p>
        ) : null}
      </div>
    </main>
  );
}
