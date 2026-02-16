import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Backwards-compatible exports:
 * - createClient()  -> for older code in your repo
 * - createBrowserClient() -> the newer name we’re using
 */
function makeBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function createBrowserClient() {
  return makeBrowserClient();
}

// ✅ This fixes your build error (old files expect createClient)
export function createClient() {
  return makeBrowserClient();
}
