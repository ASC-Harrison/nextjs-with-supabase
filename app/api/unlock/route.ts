import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const enteredPin = String(body?.pin ?? "").trim();
    const correctPin = String(process.env.MASTER_PIN ?? "").trim();

    if (!correctPin) {
      return NextResponse.json({ ok: false, error: "MASTER_PIN not set" }, { status: 500 });
    }
    if (!enteredPin) {
      return NextResponse.json({ ok: false, error: "PIN required" }, { status: 400 });
    }
    if (enteredPin !== correctPin) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/unlock" });
}
