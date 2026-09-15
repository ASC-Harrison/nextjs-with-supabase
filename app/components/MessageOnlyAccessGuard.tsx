"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
const ALLOWED_PATH = "/message-brooklyn";

export default function MessageOnlyAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === ALLOWED_PATH || PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
      return;
    }

    let cancelled = false;
    async function enforceAccess() {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;

      const response = await fetch("/api/access-role", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;

      const access = await response.json();
      if (access.message_only) router.replace(ALLOWED_PATH);
    }

    void enforceAccess();
    return () => { cancelled = true; };
  }, [pathname, router]);

  return null;
}
