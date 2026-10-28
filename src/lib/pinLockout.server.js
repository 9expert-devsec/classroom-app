// src/lib/pinLockout.server.js
//
// PIN-P2b: lockout for kiosk PIN attempts, safe on serverless (Mongo, not memory).
//
//   collection "ratelimits" (shared with rateLimit.server.js, reuses its TTL
//   index on expiresAt), one doc per key:
//     { _id: "kiosk.pin:<scope>:<key>", bucket, fails, lockedUntil, lockedAt, expiresAt }
//   scope = "dev" (open: kiosk_device cookie) · "sid" (unlock: kiosk session)
//           · "ip" (open: loose per-IP cap)
//
//   - checkPinLock BEFORE looking at the PIN: a locked key cannot test PINs at all
//   - recordPinFailure: one atomic pipeline update. The limit-th failure locks for
//     lockMs. An expired lock, or no failure for windowMs, starts again at 0.
//   - clearPinFailures on success (not for the IP cap)
//
// FAIL CLOSED: every function throws on a storage error; callers answer 503
// pin_unavailable and never let the attempt through. (rateLimit.server.js
// fails open on purpose - not here.)
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";

const COLLECTION = "ratelimits";
const PREFIX = "kiosk.pin";

export const PIN_FAIL_LIMIT = 5;
export const PIN_LOCK_MS = 10 * 60 * 1000;
export const PIN_IP_FAIL_LIMIT = 30;
export const PIN_WINDOW_MS = 10 * 60 * 1000;

function collection() {
  return mongoose.connection.db.collection(COLLECTION);
}

export function pinLockId(scope, key) {
  return `${PREFIX}:${scope}:${key}`;
}

/** { locked, retryAfter (s), lockedUntil, fails } for one key. Throws on storage error. */
export async function checkPinLock(id, now = new Date()) {
  await dbConnect();
  const doc = await collection().findOne({ _id: id });
  const until = doc?.lockedUntil ? new Date(doc.lockedUntil).getTime() : 0;
  const locked = until > now.getTime();
  return {
    locked,
    retryAfter: locked ? Math.max(1, Math.ceil((until - now.getTime()) / 1000)) : 0,
    lockedUntil: locked ? new Date(until) : null,
    fails: locked || (doc?.expiresAt && new Date(doc.expiresAt) > now) ? doc?.fails || 0 : 0,
  };
}

/**
 * One more failure on this key.
 * Returns { fails, locked, lockedNow, lockedUntil, retryAfter }:
 *   lockedNow = this call created the lock (write kiosk.pin_lockout only then).
 * A call that lands while a lock is already active changes nothing.
 * Throws on storage error.
 */
export async function recordPinFailure(
  id,
  { limit = PIN_FAIL_LIMIT, lockMs = PIN_LOCK_MS, windowMs = PIN_WINDOW_MS, now = new Date() } = {},
) {
  await dbConnect();
  const lockUntil = new Date(now.getTime() + lockMs);
  const windowEnd = new Date(now.getTime() + windowMs);

  const active = { $gt: [{ $ifNull: ["$lockedUntil", new Date(0)] }, now] };
  // stale = an expired lock, or the last failure is older than the window
  const stale = {
    $or: [
      { $and: [{ $ne: [{ $ifNull: ["$lockedUntil", null] }, null] }, { $lte: ["$lockedUntil", now] }] },
      { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now] },
    ],
  };
  const nextFails = { $add: [{ $cond: [stale, 0, { $ifNull: ["$fails", 0] }] }, 1] };

  const doc = await collection().findOneAndUpdate(
    { _id: id },
    [
      {
        $set: {
          bucket: PREFIX,
          _active: active,
          _next: nextFails,
        },
      },
      {
        $set: {
          fails: { $cond: ["$_active", "$fails", "$_next"] },
          lockedAt: {
            $cond: ["$_active", "$lockedAt", { $cond: [{ $gte: ["$_next", limit] }, now, null] }],
          },
          lockedUntil: {
            $cond: ["$_active", "$lockedUntil", { $cond: [{ $gte: ["$_next", limit] }, lockUntil, null] }],
          },
          expiresAt: {
            $cond: [
              "$_active",
              "$expiresAt",
              { $cond: [{ $gte: ["$_next", limit] }, new Date(lockUntil.getTime() + 60_000), windowEnd] },
            ],
          },
        },
      },
      { $unset: ["_active", "_next"] },
    ],
    { upsert: true, returnDocument: "after" },
  );

  // driver v6 returns the document, v5 returns { value }
  const d = doc?.value ?? doc;
  const until = d?.lockedUntil ? new Date(d.lockedUntil).getTime() : 0;
  const locked = until > now.getTime();
  return {
    fails: d?.fails || 0,
    locked,
    lockedNow: locked && !!d?.lockedAt && new Date(d.lockedAt).getTime() === now.getTime(),
    lockedUntil: locked ? new Date(until) : null,
    retryAfter: locked ? Math.max(1, Math.ceil((until - now.getTime()) / 1000)) : 0,
  };
}

/** Success: forget this key's failures. Throws on storage error. */
export async function clearPinFailures(id) {
  await dbConnect();
  await collection().deleteOne({ _id: id });
}
