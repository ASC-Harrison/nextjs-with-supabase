"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ScanLine = {
  row_id: string;
  extracted_name: string;
  extracted_reference: string | null;
  qty: number;
  status: "OPEN" | "HOLD" | "PRN";
  notes: string | null;
  match: {
    id: string;
    name: string;
    reference_number: string | null;
    vendor: string | null;
    category: string | null;
    unit: string | null;
  } | null;
  confidence: "high" | "medium" | "unmatched";
  score: number;
  included?: boolean;
};

type ScanDraft = {
  surgeon: string;
  procedure_name: string;
  specialty: string;
  notes: string;
  items: ScanLine[];
};

type Photo = {
  id: string;
  name: string;
  dataUrl: string;
};

const MAX_PAGES = 3;

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = document.createElement("img");
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not open photo"));
    element.src = source;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

export default function PreferenceCardScannerPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    const lines = draft?.items || [];
    return {
      total: lines.length,
      high: lines.filter(line => line.confidence === "high").length,
      medium: lines.filter(line => line.confidence === "medium").length,
      unmatched: lines.filter(line => line.confidence === "unmatched").length,
      selected: lines.filter(line => line.match && line.included !== false).length,
    };
  }, [draft]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    const available = MAX_PAGES - photos.length;
    if (available <= 0) return setMessage("You can scan up to three pages at a time.");
    try {
      const selected = Array.from(files).slice(0, available);
      const compressed = await Promise.all(selected.map(async file => ({
        id: crypto.randomUUID(),
        name: file.name || "Preference card page",
        dataUrl: await compressImage(file),
      })));
      setPhotos(current => [...current, ...compressed]);
      setDraft(null);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not prepare photo");
    }
  }

  async function scan() {
    if (!photos.length || scanning) return;
    setScanning(true);
    setMessage(null);
    setDraft(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/pref-card-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({ images: photos.map(photo => photo.dataUrl) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "The card could not be read.");
      setDraft({
        ...result.draft,
        items: result.draft.items.map((line: ScanLine) => ({ ...line, included: Boolean(line.match) })),
      });
      setMessage("Draft ready. Review every yellow and red line before saving.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function updateLine(rowId: string, patch: Partial<ScanLine>) {
    setDraft(current => current ? {
      ...current,
      items: current.items.map(line => line.row_id === rowId ? { ...line, ...patch } : line),
    } : current);
  }

  async function saveDraft() {
    if (!draft || saving) return;
    if (!draft.surgeon.trim() || !draft.procedure_name.trim()) {
      return setMessage("Enter the surgeon and procedure before saving.");
    }

    const selected = draft.items.filter(line => line.match && line.included !== false);
    if (!selected.length) return setMessage("Select at least one matched inventory item.");
    if (!window.confirm("Create this preference card with " + selected.length + " matched items? Inventory counts will not change.")) return;

    setSaving(true);
    setMessage(null);
    let createdCardId = "";
    try {
      const { data: card, error: cardError } = await supabase
        .from("pref_cards")
        .insert({
          surgeon: draft.surgeon.trim(),
          procedure_name: draft.procedure_name.trim(),
          specialty: draft.specialty.trim() || null,
          notes: draft.notes.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (cardError || !card) throw cardError || new Error("Card could not be created");
      createdCardId = card.id;

      const { error: lineError } = await supabase.from("pref_card_items").insert(
        selected.map((line, index) => ({
          pref_card_id: card.id,
          item_id: line.match!.id,
          qty: line.qty,
          status: line.status,
          notes: line.notes,
          sort_order: index + 1,
        }))
      );

      if (lineError) throw lineError;
      setMessage("Preference card created successfully. Inventory counts were not changed.");
      setPhotos([]);
      setDraft(null);
    } catch (error: unknown) {
      if (createdCardId) await supabase.from("pref_cards").delete().eq("id", createdCardId);
      setMessage(error instanceof Error ? error.message : "Card could not be saved");
    } finally {
      setSaving(false);
    }
  }

  const tone = (confidence: ScanLine["confidence"]) =>
    confidence === "high"
      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
      : confidence === "medium"
        ? "border-amber-300/25 bg-amber-300/[0.06]"
        : "border-rose-400/25 bg-rose-400/[0.06]";

  return (
    <main className="min-h-screen bg-[#07101e] px-4 py-5 text-white md:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-bold ring-1 ring-white/10">← AI Admin</Link>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black tracking-widest text-emerald-200 ring-1 ring-emerald-300/20">DRAFT-ONLY MODE</span>
        </div>

        <section className="mt-5 overflow-hidden rounded-[32px] border border-cyan-300/20 bg-gradient-to-br from-slate-900 via-blue-950/80 to-slate-950 p-5 shadow-2xl md:p-8">
          <div className="text-4xl">📷</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">AI Preference Card Scanner</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 md:text-base">
            Photograph the paper card. AI will extract its lines and match them to your existing item list. Nothing is saved until you review and approve the draft.
          </p>
          <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100/80">
            🛡️ This scanner never changes on-hand quantities, PAR levels, pricing, or storage locations.
          </div>
        </section>

        {!draft ? (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-7">
            <h2 className="text-xl font-black">1. Add clear photos</h2>
            <p className="mt-1 text-sm text-white/45">Lay each page flat, avoid glare, and include the entire page. Up to three pages.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer rounded-3xl border border-dashed border-cyan-300/30 bg-cyan-300/[0.06] p-6 text-center transition hover:bg-cyan-300/[0.1]">
                <span className="block text-3xl">📸</span>
                <span className="mt-2 block font-black text-cyan-100">Take a photo</span>
                <span className="mt-1 block text-xs text-cyan-100/50">Uses the back camera</span>
                <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={event => { void addFiles(event.target.files); event.currentTarget.value = ""; }} />
              </label>
              <label className="cursor-pointer rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center transition hover:bg-white/[0.06]">
                <span className="block text-3xl">🗂️</span>
                <span className="mt-2 block font-black">Choose existing photos</span>
                <span className="mt-1 block text-xs text-white/40">Select multiple pages</span>
                <input className="sr-only" type="file" accept="image/*" multiple onChange={event => { void addFiles(event.target.files); event.currentTarget.value = ""; }} />
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <Image src={photo.dataUrl} alt={"Preference card page " + (index + 1)} width={400} height={300} unoptimized className="h-40 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 p-3">
                      <span className="truncate text-xs font-bold">Page {index + 1}</span>
                      <button type="button" onClick={() => setPhotos(current => current.filter(item => item.id !== photo.id))} className="text-xs font-bold text-rose-300">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!photos.length || scanning}
              onClick={() => void scan()}
              className="mt-5 w-full rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {scanning ? "AI is reading the card…" : "Scan " + photos.length + " page" + (photos.length === 1 ? "" : "s") + " with AI"}
            </button>
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">2. Review the draft</h2>
                  <p className="mt-1 text-sm text-white/45">Correct the header and check every matched line.</p>
                </div>
                <button type="button" onClick={() => setDraft(null)} className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold ring-1 ring-white/10">Rescan</button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-white/50">Surgeon
                  <input value={draft.surgeon} onChange={event => setDraft({ ...draft, surgeon: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
                </label>
                <label className="text-xs font-bold text-white/50">Procedure
                  <input value={draft.procedure_name} onChange={event => setDraft({ ...draft, procedure_name: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
                </label>
                <label className="text-xs font-bold text-white/50">Specialty
                  <input value={draft.specialty} onChange={event => setDraft({ ...draft, specialty: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
                </label>
                <label className="text-xs font-bold text-white/50">Card notes
                  <input value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["LINES", summary.total],
                ["MATCHED", summary.high],
                ["REVIEW", summary.medium],
                ["NOT FOUND", summary.unmatched],
                ["SELECTED", summary.selected],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center">
                  <div className="text-[9px] font-black tracking-widest text-white/35">{label}</div>
                  <div className="mt-1 text-xl font-black">{value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {draft.items.map(line => (
                <article key={line.row_id} className={"rounded-3xl border p-4 " + tone(line.confidence)}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(line.match && line.included !== false)}
                      disabled={!line.match}
                      onChange={event => updateLine(line.row_id, { included: event.target.checked })}
                      className="mt-1 h-5 w-5 accent-cyan-300"
                      aria-label={"Include " + line.extracted_name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black tracking-widest text-white/35">CARD READ</div>
                          <div className="mt-1 font-black">{line.extracted_name}</div>
                          <div className="mt-1 text-xs text-white/45">{line.extracted_reference || "No reference number read"}</div>
                        </div>
                        <span className={"rounded-full px-2.5 py-1 text-[10px] font-black " + (line.confidence === "high" ? "bg-emerald-300/15 text-emerald-200" : line.confidence === "medium" ? "bg-amber-300/15 text-amber-100" : "bg-rose-300/15 text-rose-200")}>
                          {line.confidence === "high" ? "MATCHED" : line.confidence === "medium" ? "CHECK MATCH" : "NOT FOUND"}
                        </span>
                      </div>

                      {line.match ? (
                        <div className="mt-3 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
                          <div className="text-[10px] font-black tracking-widest text-cyan-200/60">INVENTORY MATCH</div>
                          <div className="mt-1 text-sm font-black text-cyan-100">{line.match.name}</div>
                          <div className="mt-1 text-xs text-white/40">{line.match.reference_number || "No reference"} · {line.match.vendor || "No vendor"} · {line.score}% confidence</div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-rose-950/30 p-3 text-xs leading-5 text-rose-100/70 ring-1 ring-rose-300/15">
                          This line will not be saved. Add or correct the inventory item first, then scan again.
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <label className="text-[10px] font-bold text-white/40">QUANTITY
                          <input type="number" min="0" step="0.01" value={line.qty} onChange={event => updateLine(line.row_id, { qty: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                        <label className="text-[10px] font-bold text-white/40">TYPE
                          <select value={line.status} onChange={event => updateLine(line.row_id, { status: event.target.value as ScanLine["status"] })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                            <option value="OPEN">Open</option>
                            <option value="HOLD">Hold</option>
                            <option value="PRN">PRN</option>
                          </select>
                        </label>
                        <label className="col-span-2 text-[10px] font-bold text-white/40 sm:col-span-1">LINE NOTES
                          <input value={line.notes || ""} onChange={event => updateLine(line.row_id, { notes: event.target.value || null })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                        </label>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="sticky bottom-3 rounded-3xl border border-cyan-300/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
              <button type="button" disabled={saving || summary.selected === 0} onClick={() => void saveDraft()} className="w-full rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-40">
                {saving ? "Creating preference card…" : "Approve & Create Card (" + summary.selected + " items)"}
              </button>
              <p className="mt-2 text-center text-[10px] text-white/35">Creates a preference card only. Inventory quantities remain unchanged.</p>
            </div>
          </section>
        )}

        {message ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white/75">{message}</div> : null}
      </div>
    </main>
  );
}
