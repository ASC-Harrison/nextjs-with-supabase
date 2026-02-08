import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const pin = String(form.get("pin") ?? "");
  const next = String(form.get("next") ?? "/app");

  const masterPin = process.env.MASTER_PIN;

  if (!masterPin) {
    return NextResponse.json(
      { ok: false, error: "MASTER_PIN is not set" },
      { status: 500 }
    );
  }

  if (pin !== masterPin) {
    // Redirect back with a simple failure (no fancy error needed)
    const url = new URL("/lock", req.url);
    url.searchParams.set("next", next);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, 302);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 302);
  res.cookies.set("inventory_unlocked", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
