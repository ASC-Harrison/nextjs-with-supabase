"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrowserMultiFormatReader } from "@zxing/browser";

type CaseRow = {
  id: string;
  scheduled_at: string | null;
  procedure: string;
  surgeon: string;
  room: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const LS = {
  STAFF: "asc_staff_name_v1",
};

export default function CasesPage() {
  const router = useRouter();

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Create modal
  const [open, setOpen] = useState(false);
  const [procedure, setProcedure] = useState("");
  const [surgeon, setSurgeon] = useState("");
  const [room, setRoom] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  // Staff (reuse your existing localStorage)
  const [staff, setStaff] = useState("");

  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    try {
      setStaff(localStorage.getItem(LS.STAFF) || "");
    } catch {}
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/cases/list", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRows(json.cases ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load cases");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function fmt(dt: string | null) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  async function createCase() {
    if (!procedure.trim()) return alert("Enter procedure");
    const body = {
      procedure: procedure.trim(),
      surgeon: surgeon.trim(),
      room: room.trim(),
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      staff: staff.trim() || "Unknown",
      device_id: "web",
    };

    const res = await fetch("/api/cases/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!json.ok) return alert(`Create failed: ${json.error}`);

    setOpen(false);
    setProcedure("");
    setSurgeon("");
    setRoom("");
    setScheduledAt("");

    // Go to case
    router.push(`/cases/${json.case.id}`);
  }

  async function startScanner() {
    setScannerOpen(true);
    await new Promise((r) => setTimeout(r, 80));

    if (!videoRef.current) return;

    stopScanner();

    try {
      const mod = await import("@zxing/browser");
      const Reader = mod.BrowserMultiFormatReader;
      const reader = new Reader();
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      const v: any = videoRef.current;
      v.srcObject = stream;
      await v.play();

      const decodeFromVideoElement = (reader as any).decodeFromVideoElement?.bind(reader);

      const onResult = async (result: any) => {
        if (!result) return;
        const text = result.getText?.() ?? "";
        if (!text) return;

        stopScanner();
        setScannerOpen(false);

        // Case barcode = case_id
        router.push(`/cases/${text.trim()}`);
      };

      if (decodeFromVideoElement) {
        await decodeFromVideoElement(videoRef.current, onResult);
      } else {
        await reader.decodeFromVideoDevice(undefined, videoRef.current, onResult);
      }
    } catch {
      setScannerOpen(false);
      alert("Camera blocked. On iPhone: Settings → Safari → Camera → Allow.");
    }
  }

  function stopScanner() {
    try {
      (readerRef.current as any)?.reset?.();
    } catch {}
    readerRef.current = null;

    try {
      const v = videoRef.current as any;
      const stream = v?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    } catch {}
  }

  function closeScanner() {
    stopScanner();
    setScannerOpen(false);
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex justify-center">
      <div className="w-full max-w-md px-3 pb-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => router.push("/inventory")}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ← Inventory
          </button>
          <button
            onClick={() => setOpen(true)}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-black"
          >
            + New Case
          </button>
        </div>

        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-2xl font-extrabold">Case Mode</div>
          <div className="mt-1 text-xs text-white/60">
            Scan a case barcode to open a case session (Hold + Use/Open).
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={startScanner}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
            >
              📷 Scan Case
            </button>
            <button
              onClick={load}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/10"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3">
            <div className="text-xs text-white/60 mb-1">Staff (from your Inventory app)</div>
            <input
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
                try { localStorage.setItem(LS.STAFF, e.target.value); } catch {}
              }}
              className="w-full rounded-2xl bg-white text-black px-4 py-3"
              placeholder="e.g., Jeremy Johnson"
            />
          </div>
        </div>

        <div className="mt-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Cases</div>
            <div className="text-xs text-white/60">{loading ? "Loading…" : `${rows.length}`}</div>
          </div>

          {err && <div className="mt-2 text-sm text-red-300 break-words">{err}</div>}

          <div className="mt-3 space-y-2">
            {rows.slice(0, 60).map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className="w-full text-left rounded-2xl bg-black/30 p-3 ring-1 ring-white/10"
              >
                <div className="text-sm font-semibold break-words">{c.procedure}</div>
                <div className="mt-1 text-xs text-white/60 break-words">
                  {c.surgeon || "—"} • {c.room || "—"} • {c.status}
                </div>
                <div className="mt-1 text-[11px] text-white/50">Scheduled: {fmt(c.scheduled_at)}</div>
                <div className="mt-1 text-[11px] text-white/50 break-all">ID: {c.id}</div>
              </button>
            ))}
            {!loading && rows.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-3 text-sm text-white/60 ring-1 ring-white/10">
                No cases yet. Tap “New Case”.
              </div>
            )}
          </div>
        </div>

        {open && (
          <Modal title="Create case" okText="Create" onOk={createCase} onCancel={() => setOpen(false)}>
            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Procedure *</div>
              <input
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g., Lap Chole"
              />
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Surgeon</div>
              <input
                value={surgeon}
                onChange={(e) => setSurgeon(e.target.value)}
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g., Dr. Smith"
              />
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Room</div>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
                placeholder="e.g., OR1"
              />
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Scheduled (optional)</div>
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                className="w-full rounded-2xl bg-white text-black px-4 py-3"
              />
            </div>

            <div className="mt-2 text-[11px] text-white/55">
              After creation, the case barcode is simply the <span className="font-semibold">case ID</span>.
            </div>
          </Modal>
        )}

        {scannerOpen && (
          <div className="fixed inset-0 z-[60] bg-black">
            <div
              className="flex items-center justify-between px-4"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 12 }}
            >
              <div className="text-lg font-semibold">Scan case barcode</div>
              <button
                onClick={closeScanner}
                className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10"
              >
                Close
              </button>
            </div>

            <div className="relative w-full" style={{ height: "calc(100vh - 120px)" }}>
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-52 w-80 rounded-2xl ring-2 ring-white/40" />
              </div>
            </div>

            <div className="px-4 text-xs text-white/70" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
              Scan the case barcode (it should contain the case ID).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, children, okText, onOk, onCancel }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#111] p-4 ring-1 ring-white/10">
        <div className="text-lg font-semibold">{title}</div>
        {children}
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl bg-white/10 px-4 py-3 font-semibold">
            Cancel
          </button>
          <button onClick={onOk} className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-black">
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}
