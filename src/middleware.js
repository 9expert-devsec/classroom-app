// src/middleware.js
import { NextResponse } from "next/server";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";
const ADMIN_KEY = process.env.ADMIN_KEY || "a1exqwvCqTXP7s0";

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const path = pathname || "/";

  // ✅ อย่าให้ middleware ไปยุ่งกับ API routes (ไม่งั้น /api/admin/* จะโดนเข้าเคส adminKey=api)
  if (path.startsWith("/api")) return NextResponse.next();

  // redirect home
  if (path === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/classroom/";
    return NextResponse.redirect(url);
  }

  // ✅ กัน /admin เดิมให้เป็น 404
  if (path === "/admin" || path.startsWith("/admin/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // ✅ ตรวจรูปแบบ /:adminKey/admin/...
  const m = path.match(/^\/([^/]+)\/admin(\/.*)?$/);
  if (!m) return NextResponse.next();

  const keyFromPath = m[1];

  // ✅ key ไม่ตรง -> 404
  if (keyFromPath !== ADMIN_KEY) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // ✅ public login path
  if (path === `/${ADMIN_KEY}/admin/login`) {
    return NextResponse.next();
  }

  // ✅ protect admin pages
  const token = req.cookies.get(TOKEN_NAME)?.value;
  if (!token) {
    const loginUrl = new URL(`/${ADMIN_KEY}/admin/login`, req.url);
    loginUrl.searchParams.set("redirect", path + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/:adminKey/admin/:path*"],
};
