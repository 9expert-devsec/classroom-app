// src/app/api/kiosk/me/route.js
// The kiosk session of this device, or 401 kiosk_required (L2a).
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  isStaffUnlocked,
  requireKiosk,
} from "@/lib/kioskAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { session } = await requireKiosk(req);
    const staffUnlocked = isStaffUnlocked(session);
    return NextResponse.json({
      ok: true,
      label: session.label,
      openedByName: session.openedByName,
      expiresAt: session.expiresAt,
      // L2b: staff step-up (reading it does not slide the window)
      staffUnlocked,
      staffUnlockByName: staffUnlocked ? session.staffUnlockByName : "",
      staffUnlockUntil: staffUnlocked ? session.staffUnlockUntil : null,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
