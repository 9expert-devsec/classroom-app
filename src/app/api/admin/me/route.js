import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { requireAdmin } from "@/lib/adminAuth.server";
import { verifyPassword, hashPassword } from "@/lib/password.server";
import { writeAuditLog } from "@/lib/auditLog.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function clean(x) {
  return String(x ?? "").trim();
}

export async function GET() {
  try {
    const ctx = await requireAdmin();
    return NextResponse.json({
      ok: true,
      roleCode: ctx.roleCode,
      roleLabel: ctx.roleLabel,
      permissions: ctx.permissions,
      user: ctx.user,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function PUT(req) {
  try {
    const ctx = await requireAdmin();
    const body = await req.json();

    const name = clean(body?.name);
    const avatarUrl = clean(body?.avatarUrl);
    const avatarPublicId = clean(body?.avatarPublicId);

    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");

    const wantsPwChange = !!(currentPassword || newPassword);

    await dbConnect();
    const user = await AdminUser.findById(ctx.userId);
    if (!user) return jsonError("Not found", 404);

    const before = user.toPublic();

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      user.name = name;
    }

    let avatarChanged = false;
    if (avatarUrl) {
      user.avatar = { url: avatarUrl, publicId: avatarPublicId || "" };
      avatarChanged = true;
    }

    let passwordChanged = false;
    if (wantsPwChange) {
      if (!currentPassword) return jsonError("กรุณากรอกรหัสผ่านปัจจุบัน", 400);
      if (!newPassword) return jsonError("กรุณากรอกรหัสผ่านใหม่", 400);
      if (newPassword.length < 8)
        return jsonError("Password ต้องอย่างน้อย 8 ตัวอักษร", 400);

      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) return jsonError("Current password ไม่ถูกต้อง", 401);

      user.passwordHash = await hashPassword(newPassword);
      passwordChanged = true;
    }

    await user.save();

    const after = user.toPublic();

    await writeAuditLog({
      ctx,
      req,
      action: "update",
      entityType: "account",
      entityId: after.id,
      entityLabel: after.name || after.username,
      before,
      after,
      meta: { self: true, avatarChanged, passwordChanged },
    });

    return NextResponse.json({ ok: true, user: after });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
