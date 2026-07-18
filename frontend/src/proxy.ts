import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "session_token";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register")
  ) {
    return NextResponse.next();
  }

  // Only checks for the cookie's presence — real validation happens
  // server-side against the sessions table on every page load and API
  // call, so an expired or revoked token still gets redirected to /login
  // there even if it slips past this check.
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
