'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type LocationRow = {
  id: string
  name: string
}

type ScanType = 'IN' | 'OUT'

type InventoryRow = {
  id: string
  item_name: string | null
  barcode: string | null
  on_hand: number | null
  par_level: number | null
  low_stock: boolean | null
}

export default function Page() {
  // ---- Supabase client (browser) ----
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
      // Keeps build from failing; UI will show an error instead.
      return null
    }
    return createClient(url, anon)
  }, [])

  // ---- UI state ----
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [scanType, setScanType] = useState<ScanType>('OUT')
  const [barcode, setBarcode] = useState<string>('')
  const [qty, setQty] = useState<string>('1')
  const [busy, setBusy] = useState<boolean>(false)
  const [msg, setMsg] = useState<string>('')
  const [err, setErr] = useState<string>('')

  // ---- Load locations on page load ----
  useEffect(() => {
    ;(async () => {
      setErr('')
      setMsg('')

      if (!supabase) {
        setErr('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in env.')
        return
      }

      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name')

      if (error) {
        setErr(error.message)
        return
      }

      const list = (data ?? []) as LocationRow[]
      setLocations(list)

      if (list.length && !locationId) setLocationId(list[0].id)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // ---- Notification helper (browser popup) ----
  async function notifyBrowser(title: string, body: string) {
    if (typeof window === 'undefined') return

    if (!('Notification' in window)) return

    // Ask permission once (first time)
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // ignore
      }
    }

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body })
      } catch {
        // ignore
      }
    }
  }

  // ---- Main scan submit ----
  async function submitScan() {
    setErr('')
    setMsg('')

    if (!supabase) {
      setErr('Supabase client not initialized (missing env vars).')
      return
    }

    if (!locationId) {
      setErr('Location is required')
      return
    }

    const cleanBarcode = barcode.trim()
    if (!cleanBarcode) {
      setErr('Barcode is required')
      return
    }

    const amount = Math.max(1, parseInt(qty || '1', 10) || 1)

    setBusy(true)

    try {
      // 1) Find the row for this barcode + location
      const { data: item, error: findErr } = await supabase
        .from('inventory')
        .select('id, item_name, barcode, on_hand, par_level, low_stock')
        .eq('barcode', cleanBarcode)
        .eq('location_id', locationId)
        .single()

      if (findErr || !item) {
        throw new Error('Item not found for this location')
      }

      const row = item as InventoryRow
      const name = row.item_name ?? 'Unknown item'
      const currentOnHand = Number(row.on_hand ?? 0)
      const par = Number(row.par_level ?? 0)

      const newQty =
        scanType === 'OUT'
          ? Math.max(0, currentOnHand - amount)
          : currentOnHand + amount

      // low_stock = true when <= par (only if par > 0)
      const low = par > 0 && newQty <= par

      // 2) Update DB
      const { error: updateErr } = await supabase
        .from('inventory')
        .update({ on_hand: newQty, low_stock: low })
        .eq('id', row.id)

      if (updateErr) throw updateErr

      // 3) If LOW, notify
      if (low) {
        await notifyBrowser('LOW STOCK', `${name} is low (${newQty} on hand / par ${par})`)

        // Email via your Next route: app/api/notify-low-stock/route.ts
        try {
          await fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: 'Low Stock Alert',
              html: `<h2>Low Stock Alert</h2>
<p><b>Item:</b> ${escapeHtml(name)}</p>
<p><b>Barcode:</b> ${escapeHtml(row.barcode ?? cleanBarcode)}</p>
<p><b>On hand:</b> ${newQty}</p>
<p><b>Par level:</b> ${par}</p>
<p><b>Location ID:</b> ${escapeHtml(locationId)}</p>`,
            }),
          })
        } catch {
          // If email fails, we still want the scan to succeed.
        }
      }

      setMsg(`Updated ${name}: ${currentOnHand} → ${newQty}${low ? ' (LOW)' : ''}`)
      setBarcode('')
      setQty('1')
    } catch (e: any) {
      setErr(e?.message ?? 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  // ---- UI ----
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <h1 style={{ marginBottom: 6 }}>ASC Inventory Live</h1>
        <div style={{ opacity: 0.7, marginBottom: 18 }}>
          Scan IN / OUT updates on-hand instantly. LOW clears when restocked.
        </div>

        {!!err && (
          <div style={{ background: '#ffe5e5', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            <b>Error:</b> {err}
          </div>
        )}

        {!!msg && (
          <div style={{ background: '#e7ffe7', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            {msg}
          </div>
        )}

        <div style={{ border: '1px solid #ddd', borderRadius: 14, padding: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, marginBottom: 14 }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Scan Type</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setScanType('OUT')}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ddd',
                background: scanType === 'OUT' ? '#111' : '#f3f3f3',
                color: scanType === 'OUT' ? '#fff' : '#000',
              }}
            >
              OUT (use)
            </button>

            <button
              type="button"
              onClick={() => setScanType('IN')}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ddd',
                background: scanType === 'IN' ? '#111' : '#f3f3f3',
                color: scanType === 'IN' ? '#fff' : '#000',
              }}
            >
              IN (restock)
            </button>
          </div>

          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Barcode</label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            style={{ width: '100%', padding: 10, borderRadius: 10, marginBottom: 14, border: '1px solid #ddd' }}
          />

          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Qty</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            placeholder="1"
            style={{ width: '100%', padding: 10, borderRadius: 10, marginBottom: 14, border: '1px solid #ddd' }}
          />

          <button
            type="button"
            onClick={submitScan}
            disabled={busy}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: '1px solid #111',
              background: busy ? '#666' : '#111',
              color: '#fff',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Submitting…' : 'Submit Scan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Simple HTML escaping for email body
function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
