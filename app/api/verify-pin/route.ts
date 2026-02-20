// app/api/verify-pin/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin ?? "");

    const correct = process.env.LOCATION_PIN ?? "";
    if (!correct) {
      return NextResponse.json(
        { ok: false, error: "LOCATION_PIN is not set on server" },
        { status: 500 }
      );
    }

    if (pin === correct) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
