// src/lib/kioskAdmin.server.js
//
// L2b: admin view of kiosk sessions (/{key}/admin/classroom/kiosks) and revoke.
// Callers must have checked CLASSROOM_OPERATE already.
import dbConnect from "@/lib/mongoose";
import KioskSession from "@/models/KioskSession";
import { writeAuditLog } from "@/lib/auditLog.server";
import { isStaffUnlocked } from "@/lib/kioskAuth.server";

const HISTORY_DAYS = 7;
const HISTORY_LIMIT = 200;

export const REVOKE_REASON_ADMIN = "revoked by admin";

function liveFilter(now) {
  return { revokedAt: null, expiresAt: { $gt: now } };
}

/** "iPad · Safari", "Windows · Chrome", … - enough to tell devices apart. */
export function shortUserAgent(ua) {
  const s = String(ua || "");
  if (!s) return "";

  let device = "";
  if (/iPad/.test(s)) device = "iPad";
  else if (/iPhone/.test(s)) device = "iPhone";
  else if (/Android/.test(s)) device = /Mobile/.test(s) ? "Android phone" : "Android tablet";
  else if (/Windows/.test(s)) device = "Windows";
  // iPadOS Safari reports itself as a Mac
  else if (/Macintosh/.test(s)) device = "Mac/iPad";
  else if (/Linux/.test(s)) device = "Linux";

  let browser = "";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/CriOS|Chrome\//.test(s)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s)) browser = "Safari";

  const out = [device, browser].filter(Boolean).join(" · ");
  return out || s.slice(0, 40);
}

function statusOf(s, now) {
  if (s.revokedAt) {
    if (s.revokeReason === "closed on device") {
      return { status: "closed", statusLabel: "ปิดที่เครื่อง" };
    }
    return {
      status: "revoked",
      statusLabel: `เพิกถอนโดย ${s.revokedByName || "-"}`,
    };
  }
  if (!s.expiresAt || new Date(s.expiresAt) <= now) {
    return { status: "expired", statusLabel: "หมดอายุ" };
  }
  return { status: "live", statusLabel: "ใช้งานอยู่" };
}

function view(s, now) {
  const st = statusOf(s, now);
  const live = st.status === "live";
  return {
    id: String(s._id),
    label: s.label,
    openedByName: s.openedByName || "",
    openedAt: s.openedAt || null,
    expiresAt: s.expiresAt || null,
    lastSeenAt: s.lastSeenAt || null,
    ip: s.ip || "",
    userAgent: shortUserAgent(s.userAgent),
    staffUnlocked: live && isStaffUnlocked(s, now),
    staffUnlockByName: live && isStaffUnlocked(s, now) ? s.staffUnlockByName : "",
    ...st,
    revokedAt: s.revokedAt || null,
    revokedByName: s.revokedByName || "",
  };
}

/** Live sessions first (newest first), then the last 7 days of the rest. */
export async function listKioskSessions(now = new Date()) {
  await dbConnect();
  const since = new Date(now.getTime() - HISTORY_DAYS * 86400000);

  const [live, recent] = await Promise.all([
    KioskSession.find(liveFilter(now)).sort({ openedAt: -1 }).lean(),
    KioskSession.find({
      openedAt: { $gte: since },
      $nor: [liveFilter(now)],
    })
      .sort({ openedAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean(),
  ]);

  return {
    live: live.map((s) => view(s, now)),
    recent: recent.map((s) => view(s, now)),
  };
}

function actorOf(ctx) {
  return {
    user: ctx.user,
    roleCode: ctx.roleCode,
  };
}

async function auditRevoke({ ctx, req, session, bulk }) {
  try {
    await writeAuditLog({
      ctx: actorOf(ctx),
      req,
      action: "kiosk.revoke",
      entityType: "kiosk",
      entityId: String(session._id),
      entityLabel: session.label,
      meta: {
        label: session.label,
        openedByName: session.openedByName,
        reason: REVOKE_REASON_ADMIN,
        bulk: !!bulk,
      },
    });
  } catch (e) {
    console.warn("[kiosk] revoke audit failed:", e?.message || e);
  }
}

function revokeUpdate(ctx, now) {
  return {
    revokedAt: now,
    revokedBy: ctx.user.id,
    revokedByName: ctx.user.name || ctx.user.username || "",
    revokeReason: REVOKE_REASON_ADMIN,
  };
}

/** Revoke one session by id. Returns the revoked session, or null if it was not open. */
export async function revokeKioskSession({ ctx, req, id }) {
  await dbConnect();
  const now = new Date();
  const session = await KioskSession.findOneAndUpdate(
    { _id: id, revokedAt: null },
    revokeUpdate(ctx, now),
    { new: true },
  ).lean();

  if (session) await auditRevoke({ ctx, req, session, bulk: false });
  return session;
}

/** Revoke every live session. Returns how many were revoked. */
export async function revokeAllKioskSessions({ ctx, req }) {
  await dbConnect();
  const now = new Date();
  const live = await KioskSession.find(liveFilter(now)).select("_id").lean();

  let count = 0;
  for (const { _id } of live) {
    // one by one so each revoke is audited against the row it really changed
    const session = await KioskSession.findOneAndUpdate(
      { _id, revokedAt: null },
      revokeUpdate(ctx, now),
      { new: true },
    ).lean();
    if (!session) continue;
    count += 1;
    await auditRevoke({ ctx, req, session, bulk: true });
  }
  return count;
}
