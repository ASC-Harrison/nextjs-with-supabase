import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Middleware verifies the session and replaces this header from the database.
  return NextResponse.json({role:request.headers.get("x-asc-role")},{headers:{"Cache-Control":"private, no-store"}});
}
