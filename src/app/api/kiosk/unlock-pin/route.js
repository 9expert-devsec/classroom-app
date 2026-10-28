// src/app/api/kiosk/unlock-pin/route.js
//
// PIN-P2b: open the staff step-up on this kiosk with a staff PIN (5 idle
// minutes, same as /api/kiosk/unlock). body: { pin }
// Lockout key = this kiosk session (sid): 5 wrong -> 429 pin_locked for 10 min.
// Never echo or log the request body - it carries a PIN.
import { NextResponse } from "next/server";
import { authErrorResponse, kioskAuditCtx, requireKiosk } from "@/lib/kioskAuth.server";
import { adminFromUser, unlockKioskStaff } from "@/lib/kioskOpen.server";
import { attemptPin, auditPinFailure } from "@/lib/kioskPinLogin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(reason, status, extra = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status, headers: NO_STORE });
}

export async function POST(req) {
  let session;
  try {
    ({ session } = await requireKiosk(req));
  } catch (e) {
    const res = authErrorResponse(e);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return fail("bad_request", 400);
  }

  const result = await attemptPin({
    pin: body.pin,
    keys: [{ scope: "sid", key: session.sid, primary: true }],
  });

  if (result.status === "unavailable") return fail("pin_unavailable", 503);
  if (result.status === "locked") return fail("pin_locked", 429, { retryAfter: result.retryAfter });

  if (result.status === "bad") {
    await auditPinFailure({
      ctx: kioskAuditCtx(session),
      req,
      stage: "unlock",
      label: session.label,
      entityId: String(session._id),
      result,
    });
    if (result.locked) return fail("pin_locked", 429, { retryAfter: result.retryAfter });
    return fail("bad_pin", 401, { remaining: result.remaining });
  }

  const admin = adminFromUser(result.user);
  const { name, until } = await unlockKioskStaff({ session, admin, req, via: "pin" });

  return NextResponse.json(
    { ok: true, staffUnlocked: true, staffUnlockByName: name, staffUnlockUntil: until },
    { headers: NO_STORE },
  );
}
