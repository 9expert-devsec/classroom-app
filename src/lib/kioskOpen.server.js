// src/lib/kioskOpen.server.js
//
// PIN-P2b: what opening a kiosk and opening the staff step-up actually do,
// shared by the password routes (/api/kiosk/open, /api/kiosk/unlock) and the
// PIN routes (/api/kiosk/open-pin, /api/kiosk/unlock-pin). Moved here from
// those routes without behaviour change.
import { randomBytes } from "node:crypto";
import dbConnect from "@/lib/mongoose";
import KioskSession from "@/models/KioskSession";
import { buildPermSet } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { kioskExpiryFor, STAFF_UNLOCK_MS } from "@/lib/kioskAuth.server";
import { signKioskToken } from "@/lib/kioskToken";

function clean(x) {
  return String(x ?? "").trim();
}

/** { id, username, name, avatarUrl, roleCode, permSet } from an AdminUser document. */
export function adminFromUser(user) {
  const roleCode = String(user.roleCode || "OPS").toUpperCase();
  return {
    id: String(user._id),
    username: user.username,
    name: user.name || "",
    avatarUrl: user.avatar?.url || "",
    roleCode,
    permSet: buildPermSet(roleCode, user.extraPerms || []),
  };
}

function actorCtx(admin) {
  return {
    user: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      avatarUrl: admin.avatarUrl,
    },
    roleCode: admin.roleCode,
  };
}

/**
 * Create the KioskSession for this device and sign its token. Audits
 * kiosk.open with meta.via ("credentials" | "admin_session" | "pin").
 * Returns { session, token, expiresAt, openedByName }; the caller sets the cookie.
 */
export async function openKioskSession({ admin, label, req, via }) {
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
      ctx: actorCtx(admin),
      req,
      action: "kiosk.open",
      entityType: "kiosk",
      entityId: String(session._id),
      entityLabel: label,
      meta: { label, expiresAt, via },
    });
  } catch (e) {
    console.warn("[kiosk] open audit failed:", e?.message || e);
  }

  return { session, token, expiresAt, openedByName };
}

/**
 * Open the staff step-up on `session` for `admin` (5 idle minutes). Audits
 * kiosk.staff_unlock; meta.via is recorded only when given (PIN), so the
 * password route's audit stays exactly as before.
 * Returns { name, until }.
 */
export async function unlockKioskStaff({ session, admin, req, via }) {
  const name = admin.name || admin.username;
  const until = new Date(Date.now() + STAFF_UNLOCK_MS);

  await KioskSession.updateOne(
    { _id: session._id },
    {
      staffUnlockBy: admin.id,
      staffUnlockByName: name,
      staffUnlockUntil: until,
    },
  );

  try {
    await writeAuditLog({
      ctx: actorCtx(admin),
      req,
      action: "kiosk.staff_unlock",
      entityType: "kiosk",
      entityId: String(session._id),
      entityLabel: session.label,
      meta: via ? { label: session.label, until, via } : { label: session.label, until },
    });
  } catch (e) {
    console.warn("[kiosk] unlock audit failed:", e?.message || e);
  }

  return { name, until };
}
