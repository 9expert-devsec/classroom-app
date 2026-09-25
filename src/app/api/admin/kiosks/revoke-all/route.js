// src/app/api/admin/kiosks/revoke-all/route.js
// L2b: revoke every live kiosk session. CLASSROOM_OPERATE.
import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { revokeAllKioskSessions } from "@/lib/kioskAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.CLASSROOM_OPERATE);
    const count = await revokeAllKioskSessions({ ctx, req });
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: e?.status || 500 },
    );
  }
}
