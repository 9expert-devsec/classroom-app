// src/middleware.js
import { NextResponse } from "next/server";
import {
  KIOSK_COOKIE_NAME,
  safeKioskNext,
  verifyKioskToken,
} from "@/lib/kioskToken";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";
const ADMIN_KEY = process.env.ADMIN_KEY || "a1exqwvCqTXP7s0";

// L2a: /classroom pages need a valid kiosk token (signature + expiry + typ).
// Revocation is checked by src/app/classroom/layout.jsx, which needs the DB.
const KIOSK_LOGIN_PATH = "/classroom/login";

function isClassroomPath(path) {
  return path === "/classroom" || path.startsWith("/classroom/");
}

async function guardClassroom(req, path, search) {
  // tells the classroom layout which page it is wrapping (overwrites any
  // client-sent value), so it can leave the login page unguarded
  const headers = new Headers(req.headers);
  headers.set("x-classroom-path", path);
  const pass = () => NextResponse.next({ request: { headers } });

  if (path === KIOSK_LOGIN_PATH) return pass();

  const token = req.cookies.get(KIOSK_COOKIE_NAME)?.value;
  if (token) {
    try {
      await verifyKioskToken(token);
      return pass();
    } catch {
      // fall through to login
    }
  }

  const loginUrl = new URL(KIOSK_LOGIN_PATH, req.url);
  loginUrl.searchParams.set("next", safeKioskNext(path + search));
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req) {
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
  if (!m) {
    if (isClassroomPath(path)) return guardClassroom(req, path, search);
    return NextResponse.next();
  }

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
  matcher: [
    "/",
    "/admin/:path*",
    "/:adminKey/admin/:path*",
    "/classroom",
    "/classroom/:path*",
  ],
};
