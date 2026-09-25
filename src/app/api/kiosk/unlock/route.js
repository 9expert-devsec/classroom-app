// src/app/api/kiosk/unlock/route.js
//
// L2b: open the staff step-up on this kiosk for 5 idle minutes.
// body: { username, password } - credentials must be typed on the tablet; an
// admin cookie in this browser is deliberately NOT a shortcut here.
//
// Never echo or log the request body - it carries a password.
import { NextResponse } from "next/server";
import KioskSession from "@/models/KioskSession";
import { verifyAdminCredentials } from "@/lib/adminAuth.server";
import { buildPermSet, PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  authErrorResponse,
  requireKiosk,
  STAFF_UNLOCK_MS,
} from "@/lib/kioskAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(reason, status) {
  return NextResponse.json({ ok: false, reason }, { status });
}

export async function POST(req) {
  let session;
  try {
    ({ session } = await requireKiosk(req));
  } catch (e) {
    return authErrorResponse(e);
  }

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return fail("bad_request", 400);
  }

  const user = await verifyAdminCredentials(body.username, body.password);
  if (!user) return fail("bad_credentials", 401);

  const roleCode = String(user.roleCode || "OPS").toUpperCase();
  const permSet = buildPermSet(roleCode, user.extraPerms || []);
  if (!permSet.has(PERM.CLASSROOM_OPERATE)) return fail("admin_required", 403);

  const name = user.name || user.username;
  const until = new Date(Date.now() + STAFF_UNLOCK_MS);

  await KioskSession.updateOne(
    { _id: session._id },
    {
      staffUnlockBy: user._id,
      staffUnlockByName: name,
      staffUnlockUntil: until,
    },
  );

  try {
    await writeAuditLog({
      ctx: {
        user: {
          id: String(user._id),
          username: user.username,
          name: user.name || "",
          avatarUrl: user.avatar?.url || "",
        },
        roleCode,
      },
      req,
      action: "kiosk.staff_unlock",
      entityType: "kiosk",
      entityId: String(session._id),
      entityLabel: session.label,
      meta: { label: session.label, until },
    });
  } catch (e) {
    console.warn("[kiosk] unlock audit failed:", e?.message || e);
  }

  return NextResponse.json({
    ok: true,
    staffUnlocked: true,
    staffUnlockByName: name,
    staffUnlockUntil: until,
  });
}
