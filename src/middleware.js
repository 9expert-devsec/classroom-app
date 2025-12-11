// src/middleware.js
import { NextResponse } from "next/server";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const path = pathname || "/";

  console.log("[MIDDLEWARE] path =", path);

  if (!path.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((p) => path === p)) {
    console.log("[MIDDLEWARE] public path -> pass");
    return NextResponse.next();
  }

  const token = req.cookies.get(TOKEN_NAME)?.value;
  console.log("[MIDDLEWARE] token =", token);

  if (!token) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("redirect", path + search);
    console.log("[MIDDLEWARE] no token -> redirect to", loginUrl.toString());
    return NextResponse.redirect(loginUrl);
  }

  console.log("[MIDDLEWARE] has token -> allow");
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
