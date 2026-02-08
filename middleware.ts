import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the lock screen + unlock API + static files
  if (
    pathname.startsWith("/lock") ||
    pathname.startsWith("/api/unlock") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Protect everything under /app
  if (pathname.startsWith("/app")) {
    const unlocked = req.cookies.get("inventory_unlocked")?.value;
    if (unlocked !== "1") {
      const url = req.nextUrl.clone();
      url.pathname = "/lock";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
