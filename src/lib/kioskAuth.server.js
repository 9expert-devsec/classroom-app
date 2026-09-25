// src/lib/kioskAuth.server.js
//
// Server-side kiosk session checks for /classroom (L2a).
//
// Pages accept ONLY a kiosk session. Classroom APIs accept a kiosk session or,
// through requireKioskOrAdmin, an admin session with the right permission.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import KioskSession from "@/models/KioskSession";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { bkkAt, toBkkYMD } from "@/lib/lunchConfig";
import { KIOSK_COOKIE_NAME, verifyKioskToken } from "@/lib/kioskToken";

// lastSeenAt is a hint, not a log: write it at most once a minute per session
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

// L2b: staff step-up stays open for 5 idle minutes; each staff API call slides
// the window, written at most once per 30 s
export const STAFF_UNLOCK_MS = 5 * 60 * 1000;
const STAFF_SLIDE_THROTTLE_MS = 30 * 1000;

function kioskRequired() {
  const err = new Error("Kiosk session required");
  err.status = 401;
  err.body = { ok: false, reason: "kiosk_required" };
  return err;
}

function staffUnlockRequired() {
  const err = new Error("Staff unlock required");
  err.status = 403;
  err.body = { ok: false, reason: "staff_unlock_required" };
  return err;
}

/** True while the session's staff step-up is open. */
export function isStaffUnlocked(session, now = new Date()) {
  const until = session?.staffUnlockUntil
    ? new Date(session.staffUnlockUntil).getTime()
    : 0;
  return until > now.getTime();
}

/** 23:59:59 Asia/Bangkok (+07:00) of the day `now` falls on. */
export function kioskExpiryFor(now = new Date()) {
  const lastMinute = bkkAt(toBkkYMD(now), "23:59");
  return new Date(lastMinute.getTime() + 59 * 1000);
}

function readKioskCookie(req) {
  const fromReq = req?.cookies?.get?.(KIOSK_COOKIE_NAME)?.value;
  if (fromReq !== undefined) return String(fromReq || "");
  return String(cookies().get(KIOSK_COOKIE_NAME)?.value || "");
}

/**
 * Valid kiosk session or a 401 { ok:false, reason:"kiosk_required" } error.
 * `req` is optional - server components read the cookie from next/headers.
 */
export async function requireKiosk(req) {
  const token = readKioskCookie(req);
  if (!token) throw kioskRequired();

  let sid;
  try {
    ({ sid } = await verifyKioskToken(token));
  } catch {
    throw kioskRequired();
  }

  await dbConnect();
  const session = await KioskSession.findOne({ sid }).lean();
  const now = new Date();
  if (!session) throw kioskRequired();
  if (session.revokedAt) throw kioskRequired();
  if (!session.expiresAt || new Date(session.expiresAt) <= now) {
    throw kioskRequired();
  }

  const seen = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  if (now.getTime() - seen >= LAST_SEEN_THROTTLE_MS) {
    try {
      await KioskSession.updateOne({ _id: session._id }, { lastSeenAt: now });
    } catch (e) {
      console.warn("[kiosk] lastSeenAt update failed:", e?.message || e);
    }
  }

  return { kind: "kiosk", session };
}

/**
 * Kiosk session with the staff step-up open (L2b): 401 kiosk_required when the
 * kiosk itself is not valid, 403 staff_unlock_required when it is locked.
 * On success the unlock window slides to now + 5 min.
 */
export async function requireKioskStaff(req) {
  const { session } = await requireKiosk(req);
  const now = new Date();
  if (!isStaffUnlocked(session, now)) throw staffUnlockRequired();

  const until = new Date(session.staffUnlockUntil).getTime();
  const next = now.getTime() + STAFF_UNLOCK_MS;
  if (next - until >= STAFF_SLIDE_THROTTLE_MS) {
    try {
      // only slide a window that is still open - a lock in between wins
      await KioskSession.updateOne(
        { _id: session._id, staffUnlockUntil: { $gt: now } },
        { staffUnlockUntil: new Date(next) },
      );
    } catch (e) {
      console.warn("[kiosk] staff unlock slide failed:", e?.message || e);
    }
  }

  return { kind: "kiosk", session, staff: true };
}

/**
 * Kiosk session first; otherwise an admin session holding `perm`.
 * Neither -> the same 401 kiosk_required.
 */
export async function requireKioskOrAdmin(req, perm = PERM.CLASSROOM_OPERATE) {
  try {
    return await requireKiosk(req);
  } catch {
    // fall through to admin
  }

  try {
    const ctx = await requirePerm(perm);
    return { kind: "admin", ctx };
  } catch {
    throw kioskRequired();
  }
}

/** Turn a thrown auth error into a JSON response. */
export function authErrorResponse(e) {
  const status = e?.status || 500;
  const body = e?.body || {
    ok: false,
    error: status === 500 ? "Server error" : e?.message || "Unauthorized",
  };
  return NextResponse.json(body, { status });
}

/** Route guard: null when the kiosk is staff-unlocked, else a 401/403 response. */
export async function kioskStaffGuard(req) {
  try {
    await requireKioskStaff(req);
    return null;
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** Route guard: null when the caller has a kiosk session, else a 401 response. */
export async function kioskGuard(req) {
  try {
    await requireKiosk(req);
    return null;
  } catch (e) {
    return authErrorResponse(e);
  }
}
