"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const KAYA_ALLOWED_ROUTES = ["/", "/kaya", "/order-history", "/message-kaya", "/login", "/forgot-password", "/reset-password"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isKayaRouteAllowed(pathname: string) {
  return KAYA_ALLOWED_ROUTES.some(route =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/")
  );
}

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function enforceRoleAccess() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        const response=await fetch("/api/session-role",{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
        if (!response.ok || !active) return;
        const role=(await response.json()).role;
        if(role==="kaya"&&!isKayaRouteAllowed(pathname))router.replace("/kaya");
        else if(role==="viewer"&&pathname!=="/viewer")router.replace("/viewer");
      }
    }

    void enforceRoleAccess();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if(session)setTimeout(()=>{if(active)void enforceRoleAccess();},0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
