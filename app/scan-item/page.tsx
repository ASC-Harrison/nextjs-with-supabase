"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = { id: string; name: string; reference_number: string | null; vendor: string | null; unit: string | null; };

const CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:0 16px 40px;}
  .wrap{max-width:600px;margin:0 auto;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#1e2d42;border:1px solid #1e3a5f;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;color:#94a3b8;cursor:pointer;margin-top:16px;margin-bottom:16px;font-family:inherit;}
  .cam-wrap{position:relative;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:4/3;margin-bottom:16px;border:1px solid #1e3a5f;}
  video,canvas{width:100%;height:100%;object-fit:cover;display:block;}
  .guide-box{position:absolute;top:35%;left:10%;right:10%;bottom:35%;border:2px dashed rgba(59,130,246,0.7);border-radius:8px;pointer-events:none;}
  .guide-label{position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff;font-size:12px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.8);}
  .btn{border-radius:12px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;border:none;font-family:inherit;width:100%;margin-bottom:10px;}
  .btn-capture{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;}
  .btn-capture:disabled{opacity:0.5;}
  .btn-gh{background:#1e2d42;color:#94a3b8;border:1px solid #1e3a5f;}
  .status{text-align:center;font-size:13px;color:#64748b;margin-bottom:12px;}
  .result-card{background:#162032;border:1px solid rgba(16,185,129,0.3);border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;}
  .result-name{font-size:15px;font-weight:800;color:#f0f6ff;}
  .result-meta{font-size:12px;color:#64748b;margin-top:2px;}
  .ocr-text{background:#111827;border:1px solid #1e3a5f;border-radius:10px;padding:12px;font-size:12px;color:#94a3b8;margin-bottom:12px;word-break:break-word;}
  .err-msg{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:13px;color:#fca5a5;margin-bottom:12px;}
  .manual-inp{width:100%;border-radius:10px;border:1px solid #1e3a5f;background:#111827;color:#f0f6ff;padding:12px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;}
`;

export default function ScanItemPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [tesseractLoaded, setTesseractLoaded] = useState(false);

  useEffect(() => {
    // Load Tesseract.js from CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js";
    script.async = true;
    script.onload = () => setTesseractLoaded(true);
    document.body.appendChild(script);

    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      document.body.removeChild(script);
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (e: any) {
      setError("Couldn't access camera. Check permissions in your browser/phone settings.");
    }
  }

  async function captureAndScan() {
    if (!videoRef.current || !canvasRef.current || !tesseractLoaded) return;
    setScanning(true);
    setError("");
    setResults([]);
    setOcrText("");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const Tesseract = (window as any).Tesseract;
      const result = await Tesseract.recognize(canvas, "eng", {
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-",
      });
      const text = result.data.text.trim();
      setOcrText(text || "(no text detected)");

      if (!text) {
        setError("No text detected. Try holding steadier, better lighting, or closer to the ref number.");
        setScanning(false);
        return;
      }

      // Extract likely reference-number tokens: alphanumeric chunks 3+ chars
      const tokens = text.match(/[A-Z0-9-]{3,}/gi) || [];
      const uniqueTokens = [...new Set(tokens.map(t => t.toUpperCase()))];

      if (uniqueTokens.length === 0) {
        setError("Couldn't find a clear reference number in the image. Try again or search manually.");
        setScanning(false);
        return;
      }

      // Search items for any matching reference number
      const orFilter = uniqueTokens.map(t => `reference_number.ilike.%${t}%`).join(",");
      const { data } = await supabase
        .from("items")
        .select("id,name,reference_number,vendor,unit")
        .eq("is_active", true)
        .or(orFilter)
        .limit(10);

      if (data && data.length > 0) {
        setResults(data as Item[]);
      } else {
        setError(`No items matched "${uniqueTokens.join(", ")}". Try again or search manually below.`);
      }
    } catch (e: any) {
      setError("Scan failed: " + (e?.message ?? "unknown error"));
    }
    setScanning(false);
  }

  async function manualSearch() {
    if (!manualInput.trim()) return;
    setError("");
    setResults([]);
    const { data } = await supabase
      .from("items")
      .select("id,name,reference_number,vendor,unit")
      .eq("is_active", true)
      .or(`reference_number.ilike.%${manualInput.trim()}%,name.ilike.%${manualInput.trim()}%`)
      .limit(10);
    if (data && data.length > 0) setResults(data as Item[]);
    else setError(`No items found matching "${manualInput}".`);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="root">
        <div className="wrap">
          <button onClick={() => router.push("/")} className="back-btn">← Back</button>

          <div className="cam-wrap">
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="guide-label">Center the reference number in the box</div>
            <div className="guide-box" />
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className="status">
            {!tesseractLoaded ? "Loading scanner…" : !cameraReady ? "Starting camera…" : scanning ? "🔍 Reading text…" : "Ready to scan"}
          </div>

          <button onClick={captureAndScan} disabled={!cameraReady || !tesseractLoaded || scanning} className="btn btn-capture">
            {scanning ? "Scanning…" : "📸 Scan Reference Number"}
          </button>

          {ocrText && (
            <div className="ocr-text">
              <strong>Detected text:</strong> {ocrText}
            </div>
          )}

          {error && <div className="err-msg">{error}</div>}

          {results.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Found {results.length} match{results.length > 1 ? "es" : ""}
              </div>
              {results.map(item => (
                <div key={item.id} className="result-card" onClick={() => router.push(`/inventory`)}>
                  <div className="result-name">{item.name}</div>
                  <div className="result-meta">Ref: {item.reference_number || "—"} · {item.vendor || "—"} · {item.unit || "—"}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 16, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Scan not working? Type it manually:</div>
            <input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && manualSearch()}
              placeholder="Type reference number or item name"
              className="manual-inp"
            />
            <button onClick={manualSearch} className="btn btn-gh">Search</button>
          </div>
        </div>
      </div>
    </>
  );
}
