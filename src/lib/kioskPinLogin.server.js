// src/lib/kioskPinLogin.server.js
//
// PIN-P2b: one PIN attempt at the kiosk, shared by /api/kiosk/open-pin and
// /api/kiosk/unlock-pin. Order matters:
//   1. lock check on every key (device|sid, and ip for open) - locked = stop,
//      the PIN is never looked at, not even a correct one
//   2. PIN check (malformed counts as a failure)
//   3. failure -> count on every key; success -> clear the primary key only
//      (the loose IP cap is not reset by one good PIN)
// Any storage error -> { status: "unavailable" } (fail closed).
// Never log or audit the PIN, its HMAC or a full device id.
import { writeAuditLog } from "@/lib/auditLog.server";
import { findUserByPin, isPinConfigured, isPinShape } from "@/lib/kioskPin.server";
import {
  checkPinLock,
  clearPinFailures,
  PIN_FAIL_LIMIT,
  PIN_IP_FAIL_LIMIT,
  pinLockId,
  recordPinFailure,
} from "@/lib/pinLockout.server";

/**
 * keys: [{ scope: "dev"|"sid"|"ip", key, primary?: true }]
 * Returns one of:
 *   { status: "unavailable" }
 *   { status: "locked", retryAfter, scope }
 *   { status: "bad", malformed, fails, remaining, locked, retryAfter, lockouts: [{ scope, lockedUntil }] }
 *   { status: "ok", user }
 */
export async function attemptPin({ pin, keys }) {
  if (!isPinConfigured()) return { status: "unavailable" };

  const ids = keys.map((k) => ({ ...k, id: pinLockId(k.scope, k.key) }));
  const primary = ids.find((k) => k.primary) || ids[0];

  try {
    // 1) locks first
    for (const k of ids) {
      const lock = await checkPinLock(k.id);
      if (lock.locked) return { status: "locked", retryAfter: lock.retryAfter, scope: k.scope };
    }

    // 2) the PIN
    const s = String(pin ?? "");
    const malformed = !isPinShape(s);
    const user = malformed ? null : await findUserByPin(s);

    if (user) {
      await clearPinFailures(primary.id);
      return { status: "ok", user };
    }

    // 3) one more failure on every key
    const lockouts = [];
    let primaryResult = null;
    let lockedRetry = 0;
    for (const k of ids) {
      const limit = k.scope === "ip" ? PIN_IP_FAIL_LIMIT : PIN_FAIL_LIMIT;
      const r = await recordPinFailure(k.id, { limit });
      if (k === primary) primaryResult = r;
      if (r.lockedNow) lockouts.push({ scope: k.scope, lockedUntil: r.lockedUntil });
      if (r.locked) lockedRetry = Math.max(lockedRetry, r.retryAfter);
    }
    return {
      status: "bad",
      malformed,
      fails: primaryResult.fails,
      remaining: Math.max(0, PIN_FAIL_LIMIT - primaryResult.fails),
      locked: lockedRetry > 0,
      retryAfter: lockedRetry,
      lockouts,
    };
  } catch (e) {
    console.warn("[kioskPin] attempt failed closed:", e?.message || e);
    return { status: "unavailable" };
  }
}

/** kiosk.pin_fail (+ kiosk.pin_lockout for each lock this call created). Best-effort. */
export async function auditPinFailure({ ctx, req, stage, label, entityId, result }) {
  try {
    await writeAuditLog({
      ctx,
      req,
      action: "kiosk.pin_fail",
      entityType: "kiosk",
      entityId: entityId || "",
      entityLabel: label,
      meta: { stage, label, fails: result.fails, malformed: !!result.malformed },
    });
    for (const l of result.lockouts || []) {
      await writeAuditLog({
        ctx,
        req,
        action: "kiosk.pin_lockout",
        entityType: "kiosk",
        entityId: entityId || "",
        entityLabel: label,
        meta: {
          stage,
          label,
          lockedUntil: l.lockedUntil,
          scope: { dev: "device", sid: "session", ip: "ip" }[l.scope] || l.scope,
        },
      });
    }
  } catch (e) {
    console.warn("[kioskPin] fail audit failed:", e?.message || e);
  }
}
