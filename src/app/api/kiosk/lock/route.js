// src/app/api/kiosk/lock/route.js
//
// L2b: close the staff step-up on this kiosk. Called by the "ล็อก" button and,
// fire-and-forget, every time the /classroom menu loads.
// body (optional): { source: "button" | "menu" } - recorded in the audit only.
import { NextResponse } from "next/server";
import KioskSession from "@/models/KioskSession";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  authErrorResponse,
  isStaffUnlocked,
  requireKiosk,
} from "@/lib/kioskAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set(["button", "menu"]);

export async function POST(req) {
  let session;
  try {
    ({ session } = await requireKiosk(req));
  } catch (e) {
    return authErrorResponse(e);
  }

  const body = await req.json().catch(() => ({}));
  const source = SOURCES.has(body?.source) ? body.source : "";

  // the document as it was before clearing; null when there was nothing to clear
  const before = await KioskSession.findOneAndUpdate(
    { _id: session._id, staffUnlockUntil: { $ne: null } },
    { staffUnlockBy: null, staffUnlockByName: "", staffUnlockUntil: null },
  ).lean();

  // audit only a lock that actually ended an open window
  if (before && isStaffUnlocked(before)) {
    try {
      await writeAuditLog({
        ctx: {
          user: {
            id: String(before.staffUnlockBy || ""),
            name: `kiosk: ${before.label}`,
          },
        },
        req,
        action: "kiosk.staff_lock",
        entityType: "kiosk",
        entityId: String(before._id),
        entityLabel: before.label,
        meta: {
          label: before.label,
          unlockedByName: before.staffUnlockByName,
          source,
        },
      });
    } catch (e) {
      console.warn("[kiosk] lock audit failed:", e?.message || e);
    }
  }

  return NextResponse.json({ ok: true, staffUnlocked: false });
}
