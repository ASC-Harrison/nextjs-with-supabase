import { createClient } from "@supabase/supabase-js";

// ✅ SAFE for browser/client code
// ❌ DO NOT use SUPABASE_SERVICE_ROLE_KEY here
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

