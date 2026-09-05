"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

declare global {
  interface Window {
    __ascAuthenticatedFetchInstalled?: boolean;
  }
}

function installAuthenticatedFetch() {
  if (typeof window === "undefined" || window.__ascAuthenticatedFetchInstalled) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(rawUrl, window.location.origin);

    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (!headers.has("Authorization")) {
      let accessToken: string | null = null;

      try {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token ?? null;
      } catch {
        // Fall back to the token saved by the existing sign-in flow.
      }

      accessToken ||= window.localStorage.getItem("asc_session_token");
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return originalFetch(input, { ...init, headers });
  };

  window.__ascAuthenticatedFetchInstalled = true;
}

if (typeof window !== "undefined") installAuthenticatedFetch();

export default function AuthenticatedFetch() {
  useEffect(() => {
    installAuthenticatedFetch();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        window.localStorage.setItem("asc_session_token", session.access_token);
      } else {
        window.localStorage.removeItem("asc_session_token");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
