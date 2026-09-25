// src/app/api/admin/kiosks/revoke/route.js
// L2b: revoke one kiosk session. body: { id }. CLASSROOM_OPERATE.
import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { revokeKioskSession } from "@/lib/kioskAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 500) {
  return NextResponse.json(
    { ok: false, error: message || "Server error" },
    { status },
  );
}

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.CLASSROOM_OPERATE);

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return jsonError("id ไม่ถูกต้อง", 400);

    const session = await revokeKioskSession({ ctx, req, id });
    if (!session) {
      return jsonError("ไม่พบ kiosk นี้ หรือถูกปิด/เพิกถอนไปแล้ว", 404);
    }
    return NextResponse.json({ ok: true, id, label: session.label });
  } catch (e) {
    return jsonError(e?.message, e?.status || 500);
  }
}
