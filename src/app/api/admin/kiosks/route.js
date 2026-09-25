// src/app/api/admin/kiosks/route.js
// L2b: kiosk sessions for the admin "Kiosk / Tablet" page. CLASSROOM_OPERATE.
import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { listKioskSessions } from "@/lib/kioskAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 500) {
  return NextResponse.json(
    { ok: false, error: message || "Server error" },
    { status },
  );
}

export async function GET() {
  try {
    await requirePerm(PERM.CLASSROOM_OPERATE);
    const { live, recent } = await listKioskSessions();
    return NextResponse.json(
      { ok: true, live, recent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonError(e?.message, e?.status || 500);
  }
}
