// src/app/api/admin/me/kiosk-pin/reveal/route.js
//
// PIN-P1: show the signed-in admin their own kiosk PIN (the admin session is
// enough - no password). Every reveal is audited. POST so it is never cached
// or prefetched.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth.server";
import { writeAuditLog } from "@/lib/auditLog.server";
import { isPinConfigured, revealPin } from "@/lib/kioskPin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(reason, error, status) {
  return NextResponse.json({ ok: false, reason, error }, { status, headers: NO_STORE });
}

export async function POST(req) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return fail("unauthorized", "Unauthorized", 401);
  }
  if (!isPinConfigured()) {
    return fail("pin_unavailable", "ระบบ PIN ยังไม่ได้ตั้งค่า (KIOSK_PIN_SECRET)", 500);
  }

  let pin;
  try {
    pin = await revealPin(ctx.userId);
  } catch {
    // made with another secret or tampered - never say more than that
    return fail("pin_unreadable", "อ่าน PIN ไม่ได้ กรุณาสร้าง PIN ใหม่", 500);
  }
  if (!pin) return fail("no_pin", "ยังไม่มี PIN", 404);

  try {
    await writeAuditLog({
      ctx,
      req,
      action: "kiosk.pin_reveal",
      entityType: "account",
      entityId: ctx.userId,
      entityLabel: ctx.user.name || ctx.user.username,
      meta: { self: true },
    });
  } catch (e) {
    console.warn("[kioskPin] reveal audit failed:", e?.message || e);
  }

  return NextResponse.json({ ok: true, pin }, { headers: NO_STORE });
}
