import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ONLY = ["/admin", "/staff-activity", "/admin-users", "/reports", "/labels", "/orders", "/items", "/areas"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const cookies = request.cookies.getAll();
  const hasAuth = cookies.some(c => c.name.includes("sb-") || c.name.includes("supabase"));
  const isAdminPath = ADMIN_ONLY.some(p => pathname.startsWith(p));

  if (isAdminPath && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};
