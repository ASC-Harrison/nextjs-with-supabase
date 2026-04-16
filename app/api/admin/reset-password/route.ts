import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password required" });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters" });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                process.env.SUPABASE_SERVICE_KEY ||
                process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables" });
    }

    const adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find the user by email first
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message });

    const user = users.find((u) => u.email === email.trim());
    if (!user) return NextResponse.json({ ok: false, error: `No account found for ${email}` });

    // Update their password
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, { password });
    if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
