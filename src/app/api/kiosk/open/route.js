// src/app/api/kiosk/open/route.js
//
// Open this device as a /classroom kiosk (L2a).
// body: { label, username?, password? }
//   - username/password given -> check them (no bootstrap path)
//   - otherwise               -> use the admin already logged in on this browser
// Either way the admin needs CLASSROOM_OPERATE.
//
// Never echo or log the request body - it may carry a password.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import KioskSession from "@/models/KioskSession";
import {
  requireAdmin,
  verifyAdminCredentials,
} from "@/lib/adminAuth.server";
import { buildPermSet, PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { kioskExpiryFor } from "@/lib/kioskAuth.server";
import {
  KIOSK_COOKIE_NAME,
  kioskCookieOptions,
  signKioskToken,
} from "@/lib/kioskToken";

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
    const roleCode = String(user.roleCode || "OPS").toUpperCase();
    admin = {
      id: String(user._id),
      username: user.username,
      name: user.name || "",
      avatarUrl: user.avatar?.url || "",
      roleCode,
      permSet: buildPermSet(roleCode, user.extraPerms || []),
    };
  } else {
    try {
      const ctx = await requireAdmin();
      admin = { ...ctx.user, permSet: ctx.permSet };
    } catch {
      return fail("admin_required", 401);
    }
  }

  if (!admin.permSet.has(PERM.CLASSROOM_OPERATE)) return fail("forbidden", 403);

  await dbConnect();

  const now = new Date();
  const expiresAt = kioskExpiryFor(now);
  const openedByName = admin.name || admin.username;

  const session = await KioskSession.create({
    sid: randomBytes(32).toString("base64url"),
    label,
    openedBy: admin.id,
    openedByName,
    openedAt: now,
    expiresAt,
    lastSeenAt: now,
    ip:
      clean(req.headers.get("x-forwarded-for")) ||
      clean(req.headers.get("x-real-ip")),
    userAgent: clean(req.headers.get("user-agent")),
  });

  const token = await signKioskToken(session.sid, expiresAt);

  try {
    await writeAuditLog({
      ctx: {
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          avatarUrl: admin.avatarUrl,
        },
        roleCode: admin.roleCode,
      },
      req,
      action: "kiosk.open",
      entityType: "kiosk",
      entityId: String(session._id),
      entityLabel: label,
      meta: {
        label,
        expiresAt,
        via: username || password ? "credentials" : "admin_session",
      },
    });
  } catch (e) {
    console.warn("[kiosk] open audit failed:", e?.message || e);
  }

  const res = NextResponse.json({
    ok: true,
    label,
    openedByName,
    expiresAt,
  });
  res.cookies.set(KIOSK_COOKIE_NAME, token, kioskCookieOptions(expiresAt));
  return res;
}
