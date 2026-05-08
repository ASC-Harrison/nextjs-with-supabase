import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow everything through except admin-only paths
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Always allow login and API
  if (pathname.startsWith("/login") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for any supabase auth cookie
  const cookies = request.cookies.getAll();
  const hasAuth = cookies.some(c => c.name.includes("sb-") || c.name.includes("supabase"));

  // Only block admin pages if no auth — let home and inventory through
  const ADMIN_ONLY = ["/admin", "/staff-activity", "/admin-users", "/reports", "/labels", "/orders", "/items", "/areas"];
  const isAdminPath = ADMIN_ONLY.some(p => pathname.startsWith(p));

  if (isAdminPath && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // For home and inventory — let through, the pages handle their own auth check
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};
