import { NextResponse } from "next/server";

// ✅ POST /api/unlock  { pin: "1234" }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin ?? "").trim();

    const correctPin = String(process.env.LOCATION_PIN ?? "1234").trim();

    if (!pin) {
      return NextResponse.json({ ok: false, error: "PIN required" }, { status: 400 });
    }

    if (pin !== correctPin) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}

// Optional: avoids 405 if something hits GET
export async function GET() {
  return NextResponse.json({ ok: true });
}
