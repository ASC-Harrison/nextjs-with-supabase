import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Admin-only pages — everything else is open
const ADMIN_ONLY_PATHS = ["/admin", "/staff-activity", "/admin-users", "/reports", "/labels", "/orders", "/items"];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "hogstud800@gmail.com";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // For admin-only paths, check the session cookie directly
  if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    // Check for supabase session cookie
    const hasSession = request.cookies.getAll().some(c => 
      c.name.includes("sb-") && c.name.includes("-auth-token")
    );

    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};
