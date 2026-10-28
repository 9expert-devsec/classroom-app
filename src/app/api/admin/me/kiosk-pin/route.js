// src/app/api/admin/me/kiosk-pin/route.js
//
// PIN-P1: the signed-in admin's own kiosk PIN.
//   GET                      -> { hasPin, setAt }
//   POST { currentPassword } -> new PIN (replaces the old one at once) -> { pin, setAt }
// Never echo or log the request body (password) or the PIN.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { requireAdmin } from "@/lib/adminAuth.server";
import { verifyPassword } from "@/lib/password.server";
import { writeAuditLog } from "@/lib/auditLog.server";
import { isPinConfigured, setNewPin } from "@/lib/kioskPin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function fail(reason, error, status) {
  return json({ ok: false, reason, error }, status);
}

async function auth() {
  try {
    return { ctx: await requireAdmin() };
  } catch {
    return { denied: fail("unauthorized", "Unauthorized", 401) };
  }
}

export async function GET() {
  const { ctx, denied } = await auth();
  if (denied) return denied;

  await dbConnect();
  const user = await AdminUser.findById(ctx.userId).select("kioskPinSetAt").lean();
  if (!user) return fail("not_found", "Not found", 404);

  return json({ ok: true, hasPin: !!user.kioskPinSetAt, setAt: user.kioskPinSetAt || null });
}

export async function POST(req) {
  const { ctx, denied } = await auth();
  if (denied) return denied;
  if (!isPinConfigured()) {
    return fail("pin_unavailable", "ระบบ PIN ยังไม่ได้ตั้งค่า (KIOSK_PIN_SECRET)", 500);
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword ?? "");
  if (!currentPassword) return fail("bad_password", "กรุณากรอกรหัสผ่านปัจจุบัน", 401);

  await dbConnect();
  const user = await AdminUser.findById(ctx.userId);
  if (!user) return fail("not_found", "Not found", 404);

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return fail("bad_password", "รหัสผ่านปัจจุบันไม่ถูกต้อง", 401);

  const hadPin = !!user.kioskPinSetAt;
  const res = await setNewPin(ctx.userId, ctx.userId);
  if (!res) return fail("not_found", "Not found", 404);

  try {
    await writeAuditLog({
      ctx,
      req,
      action: "kiosk.pin_regenerate",
      entityType: "account",
      entityId: ctx.userId,
      entityLabel: ctx.user.name || ctx.user.username,
      meta: { self: true, replaced: hadPin },
    });
  } catch (e) {
    console.warn("[kioskPin] regenerate audit failed:", e?.message || e);
  }

  return json({ ok: true, pin: res.pin, setAt: res.setAt });
}
