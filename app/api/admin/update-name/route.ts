import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Missing service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const { email, full_name } = await req.json();
    if (!email || !full_name) return NextResponse.json({ ok: false, error: "Email and name required" });

    const supabase = getServiceClient();

    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message });

    const user = users.find(u => u.email === email.trim());
    if (!user) return NextResponse.json({ ok: false, error: `No account found for ${email}` });

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { full_name: full_name.trim() }
    });

    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" });
  }
}
