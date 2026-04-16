import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only the login page and API routes are public
const PUBLIC_PATHS = ["/login", "/api/"];

// Only admin can access these
const ADMIN_ONLY_PATHS = [
  "/admin",
  "/staff-activity",
  "/admin-users",
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "hogstud800@gmail.com";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Not logged in — send to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userEmail = session.user.email ?? "";
  const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Non-admin trying to access admin-only page — send to inventory
  if (!isAdmin && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/inventory", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
