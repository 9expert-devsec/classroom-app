// src/app/api/kiosk/open/route.js
//
// Open this device as a /classroom kiosk (L2a).
// body: { label, username?, password? }
//   - username/password given -> check them (no bootstrap path)
//   - otherwise               -> use the admin already logged in on this browser
// Either way the admin needs CLASSROOM_OPERATE.
//
// Never echo or log the request body - it may carry a password.
import { NextResponse } from "next/server";
import {
  requireAdmin,
  verifyAdminCredentials,
} from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { adminFromUser, openKioskSession } from "@/lib/kioskOpen.server";
import { KIOSK_COOKIE_NAME, kioskCookieOptions } from "@/lib/kioskToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_MAX = 40;

function fail(reason, status) {
  return NextResponse.json({ ok: false, reason }, { status });
}

function clean(x) {
  return String(x ?? "").trim();
}

export async function POST(req) {
  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return fail("bad_request", 400);
  }

  const label = clean(body.label);
  if (!label || label.length > LABEL_MAX) return fail("label_required", 400);

  const username = clean(body.username);
  const password = clean(body.password);

  // who is opening the kiosk
  let admin = null; // { id, username, name, roleCode, permSet }
  if (username || password) {
    const user = await verifyAdminCredentials(username, password);
    if (!user) return fail("bad_credentials", 401);
    admin = adminFromUser(user);
  } else {
    try {
      const ctx = await requireAdmin();
      admin = { ...ctx.user, permSet: ctx.permSet };
    } catch {
      return fail("admin_required", 401);
    }
  }

  if (!admin.permSet.has(PERM.CLASSROOM_OPERATE)) return fail("forbidden", 403);

  const { token, expiresAt, openedByName } = await openKioskSession({
    admin,
    label,
    req,
    via: username || password ? "credentials" : "admin_session",
  });

  const res = NextResponse.json({
    ok: true,
    label,
    openedByName,
    expiresAt,
  });
  res.cookies.set(KIOSK_COOKIE_NAME, token, kioskCookieOptions(expiresAt));
  return res;
}
