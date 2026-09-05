import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type VerifiedUser = {
  id: string;
  email: string | null;
  expiresAt: number;
};

type CachedRole = {
  role: string | null;
  expiresAt: number;
};

type RateBucket = {
  count: number;
  resetsAt: number;
};

const tokenCache = new Map<string, VerifiedUser>();
const roleCache = new Map<string, CachedRole>();
const rateBuckets = new Map<string, RateBucket>();

const ADMIN_PATHS = [
  "/api/admin/",
  "/api/debug-db",
  "/api/debug-env",
  "/api/orders/delete",
];

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  return response;
}

function jsonError(message: string, status: number) {
  return withSecurityHeaders(
    NextResponse.json({ ok: false, error: message }, { status })
  );
}

function rateLimit(key: string, limit: number) {
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetsAt <= now) {
    rateBuckets.set(key, { count: 1, resetsAt: now + 60_000 });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
}

async function verifyUser(token: string): Promise<VerifiedUser | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    tokenCache.delete(token);
    return null;
  }

  const data = (await response.json()) as { id?: string; email?: string | null };
  if (!data.id) return null;

  const user = {
    id: data.id,
    email: data.email ?? null,
    expiresAt: Date.now() + 30_000,
  };

  tokenCache.set(token, user);
  return user;
}

async function getRole(userId: string): Promise<string | null> {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.role;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const endpoint = new URL("/rest/v1/app_user_roles", supabaseUrl);
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("select", "role");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const rows = (await response.json()) as Array<{ role?: string }>;
  const role = rows[0]?.role ?? null;
  roleCache.set(userId, { role, expiresAt: Date.now() + 60_000 });
  return role;
}

function isAdminPath(pathname: string) {
  return ADMIN_PATHS.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (request.method === "OPTIONS") {
    return withSecurityHeaders(NextResponse.next());
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (pathname === "/api/health" && request.method === "GET") {
    if (!rateLimit(`health:${ip}`, 30)) {
      return jsonError("Too many requests", 429);
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const userAgent = (request.headers.get("user-agent") ?? "").toLowerCase();
  if (
    pathname === "/api/inventory-check" &&
    request.method === "GET" &&
    userAgent.includes("vercel-cron/1.0")
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return jsonError("Cross-site request blocked", 403);
    }
  }

  const token = bearerToken(request);
  if (!token) return jsonError("Authentication required", 401);

  if (!rateLimit(`auth:${token.slice(-24)}`, 360)) {
    return jsonError("Too many requests", 429);
  }

  let user: VerifiedUser | null = null;
  try {
    user = await verifyUser(token);
  } catch {
    return jsonError("Authentication service unavailable", 503);
  }

  if (!user) return jsonError("Invalid or expired session", 401);

  if (isAdminPath(pathname)) {
    let role: string | null = null;
    try {
      role = await getRole(user.id);
    } catch {
      return jsonError("Authorization service unavailable", 503);
    }

    if (role !== "admin") return jsonError("Administrator access required", 403);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-asc-user-id", user.id);
  if (user.email) requestHeaders.set("x-asc-user-email", user.email);

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
