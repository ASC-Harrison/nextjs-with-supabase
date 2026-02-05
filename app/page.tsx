'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type LocationRow = {
  id: string
  name: string
}

type ScanType = 'IN' | 'OUT'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Page() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [scanType, setScanType] = useState<ScanType>('OUT')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Load locations
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name')

      if (error) {
        setErr(error.message)
        return
      }
      const rows = (data ?? []) as LocationRow[]
      setLocations(rows)
      if (rows.length) setLocationId(rows[0].id)
    })()
  }, [])

  function beep() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.06
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      setTimeout(() => {
        osc.stop()
        ctx.close()
      }, 200)
    } catch {}
  }

  async function notifyBrowser(title: string, body: string) {
    try {
      if (!('Notification' in window)) return
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    } catch {}
  }

  async function submitScan() {
    setErr('')
    setMsg('')

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
      // 1) Find the inventory row for this barcode + location
      const { data: item, error: findErr } = await supabase
        .from('inventory')
        .select('id, item_name, barcode, on_hand, par_level, low_stock')
        .eq('barcode', cleanBarcode)
        .eq('location_id', locationId)
        .single()

      if (findErr || !item) {
        throw new Error('Item not found for this location')
      }

      const currentOnHand = Number(item.on_hand ?? 0)
      const par = Number(item.par_level ?? 0)

      const newQty =
        scanType === 'OUT'
          ? Math.max(0, currentOnHand - amount)
          : currentOnHand + amount

      const low = newQty <= par

      // 2) Update inventory
      const { error: updateErr } = await supabase
        .from('inventory')
        .update({
          on_hand: newQty,
          low_stock: low,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
if (low) {
  await fetch("/api/notify-low-stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_name: item.item_name,
      barcode: item.barcode,
      location_id: locationId,
      on_hand: newQty,
      par_level: par
    })
  });
}

      if (updateErr) throw updateErr

      // 3) If low stock, alert on-device + email
      if (low) {
        beep()
        await notifyBrowser(
          'LOW STOCK',
          `${item.item_name} is low (${newQty} on hand / par ${par})`
        )

        // Send email via server-side API route
        await fetch('/api/notify-low-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: item.id,
            item_name: item.item_name,
            barcode: item.barcode,
            location_id: locationId,
            on_hand: newQty,
            par_level: par,
          }),
        })
      }

      setMsg(
        `Saved: ${item.item_name} → on_hand ${currentOnHand} → ${newQty} (${low ? 'LOW' : 'OK'})`
      )
      setBarcode('')
      setQty('1')
    } catch (e: any) {
      setErr(e?.message ?? 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
        ASC Inventory Live
      </h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Scan IN/OUT updates on-hand instantly. Low flags clear when restocked.
      </p>

      <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: 16 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
          Location
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 10 }}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
            Scan Type
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setScanType('OUT')}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ddd',
                background: scanType === 'OUT' ? '#111' : '#fff',
                color: scanType === 'OUT' ? '#fff' : '#111',
                fontWeight: 800,
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
                background: scanType === 'IN' ? '#111' : '#fff',
                color: scanType === 'IN' ? '#fff' : '#111',
                fontWeight: 800,
              }}
            >
              IN (restock)
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
            Barcode
          </label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
            Qty
          </label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
          />
        </div>

        <button
          onClick={submitScan}
          disabled={busy}
          style={{
            width: '100%',
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: '#111',
            color: '#fff',
            fontWeight: 900,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Saving…' : 'Submit Scan'}
        </button>

        {err && (
          <div style={{ marginTop: 12, color: '#b00020', fontWeight: 700 }}>
            {err}
          </div>
        )}
        {msg && (
          <div style={{ marginTop: 12, color: '#0a7', fontWeight: 700 }}>
            {msg}
          </div>
        )}
      </div>
    </main>
  )
}
