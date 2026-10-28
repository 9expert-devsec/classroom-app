// src/app/api/kiosk/open-pin/route.js
//
// PIN-P2b: open this device as a /classroom kiosk with a staff PIN.
// body: { label, pin }
//   - lockout per device (httpOnly kiosk_device cookie, set here when absent)
//     plus a loose per-IP cap; locked = 429 pin_locked before the PIN is checked
//   - wrong PIN = 401 bad_pin { remaining }; storage error = 503 pin_unavailable
// Never echo or log the request body - it carries a PIN.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminFromUser, openKioskSession } from "@/lib/kioskOpen.server";
import { attemptPin, auditPinFailure } from "@/lib/kioskPinLogin.server";
import { clientIp } from "@/lib/rateLimit.server";
import { KIOSK_COOKIE_NAME, kioskCookieOptions } from "@/lib/kioskToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_MAX = 40;
const DEVICE_COOKIE = "kiosk_device";
const DEVICE_RE = /^[A-Za-z0-9_-]{22}$/; // 128-bit base64url
const DEVICE_MAX_AGE = 365 * 24 * 60 * 60;
const NO_STORE = { "Cache-Control": "no-store" };

function clean(x) {
  return String(x ?? "").trim();
}

function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  };
}

export async function POST(req) {
  // the device id: existing cookie, or a new one that every response sets
  const existing = clean(req.cookies.get(DEVICE_COOKIE)?.value);
  const deviceId = DEVICE_RE.test(existing) ? existing : randomBytes(16).toString("base64url");
  const isNewDevice = deviceId !== existing;

  const reply = (body, status = 200) => {
    const res = NextResponse.json(body, { status, headers: NO_STORE });
    if (isNewDevice) res.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
    return res;
  };
  const fail = (reason, status, extra = {}) => reply({ ok: false, reason, ...extra }, status);

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return fail("bad_request", 400);
  }

  const label = clean(body.label);
  if (!label || label.length > LABEL_MAX) return fail("label_required", 400);

  const result = await attemptPin({
    pin: body.pin,
    keys: [
      { scope: "dev", key: deviceId, primary: true },
      { scope: "ip", key: clientIp(req) },
    ],
  });

  if (result.status === "unavailable") return fail("pin_unavailable", 503);
  if (result.status === "locked") return fail("pin_locked", 429, { retryAfter: result.retryAfter });

  if (result.status === "bad") {
    // actor: this device (first 8 chars of its id only) - there is no session yet
    const actor = `kiosk-device:${deviceId.slice(0, 8)}`;
    const ctx = { user: { id: "", username: actor, name: actor, avatarUrl: "" }, roleCode: "KIOSK" };
    await auditPinFailure({ ctx, req, stage: "open", label, entityId: "", result });
    if (result.locked) return fail("pin_locked", 429, { retryAfter: result.retryAfter });
    return fail("bad_pin", 401, { remaining: result.remaining });
  }

  const admin = adminFromUser(result.user);
  const { token, expiresAt, openedByName } = await openKioskSession({
    admin,
    label,
    req,
    via: "pin",
  });

  const res = reply({ ok: true, label, openedByName, expiresAt });
  res.cookies.set(KIOSK_COOKIE_NAME, token, kioskCookieOptions(expiresAt));
  return res;
}
