"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const KAYA_EMAIL = "kayalivhuebner@gmail.com";
const KAYA_ALLOWED_ROUTES = ["/", "/kaya", "/login", "/forgot-password", "/reset-password"];

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

    async function enforceKayaAccess() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const isKaya = data.session?.user.email?.toLowerCase() === KAYA_EMAIL;
      if (isKaya && !isKayaRouteAllowed(pathname)) {
        router.replace("/kaya");
      }
    }

    void enforceKayaAccess();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const isKaya = session?.user.email?.toLowerCase() === KAYA_EMAIL;
      if (isKaya && !isKayaRouteAllowed(pathname)) {
        router.replace("/kaya");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
