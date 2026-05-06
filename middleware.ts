import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ONLY_PATHS = ["/admin", "/staff-activity", "/admin-users", "/reports", "/labels", "/orders", "/items"];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "hogstud800@gmail.com";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Allow login and API routes through
  if (pathname.startsWith("/login") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for session cookie
  const hasSession = request.cookies.getAll().some(c =>
    c.name.includes("sb-") && c.name.includes("-auth-token")
  );

  // Not logged in — redirect to login
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};
