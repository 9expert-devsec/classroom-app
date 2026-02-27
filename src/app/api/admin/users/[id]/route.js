import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { hashPassword } from "@/lib/password.server";
import { writeAuditLog } from "@/lib/auditLog.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function clean(x) {
  return String(x || "").trim();
}
async function getId(ctx) {
  const p = await ctx?.params; // ✅ Next 16
  return p?.id || "";
}

export async function GET(_req, ctx) {
  try {
    await requirePerm(PERM.ACCOUNTS_MANAGE);
    await dbConnect();

    const id = await getId(ctx);
    const user = await AdminUser.findById(id);
    if (!user) return jsonError("Not found", 404);

    return NextResponse.json({ ok: true, item: user.toPublic() });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function PUT(req, ctx) {
  try {
    const adminCtx = await requirePerm(PERM.ACCOUNTS_MANAGE);
    const id = await getId(ctx);

    const body = await req.json();
    const name = clean(body?.name);
    const roleCode = clean(body?.roleCode).toUpperCase();
    const isActive = body?.isActive;
    const password = String(body?.password ?? "");

    const avatarUrl = clean(body?.avatarUrl);
    const avatarPublicId = clean(body?.avatarPublicId);

    await dbConnect();
    const user = await AdminUser.findById(id);
    if (!user) return jsonError("Not found", 404);

    const before = user.toPublic();

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      user.name = name;
    }

    if (roleCode) {
      if (!["SA", "OPS", "EVT"].includes(roleCode))
        return jsonError("roleCode invalid", 400);
      user.roleCode = roleCode;
    }

    if (typeof isActive === "boolean") user.isActive = isActive;

    let passwordChanged = false;
    if (password) {
      if (password.length < 8)
        return jsonError("password ต้องอย่างน้อย 8 ตัวอักษร", 400);
      user.passwordHash = await hashPassword(password);
      passwordChanged = true;
    }

    let avatarChanged = false;
    if (avatarUrl) {
      user.avatar = { url: avatarUrl, publicId: avatarPublicId || "" };
      avatarChanged = true;
    }

    await user.save();

    const after = user.toPublic();

    await writeAuditLog({
      ctx: adminCtx,
      req,
      action: "update",
      entityType: "account",
      entityId: after.id,
      entityLabel: after.name || after.username,
      before,
      after,
      meta: { passwordChanged, avatarChanged },
    });

    return NextResponse.json({ ok: true, item: after });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function DELETE(req, ctx) {
  try {
    const adminCtx = await requirePerm(PERM.ACCOUNTS_MANAGE);
    const id = await getId(ctx);

    await dbConnect();
    const user = await AdminUser.findById(id);
    if (!user) return jsonError("Not found", 404);

    const before = user.toPublic();

    await AdminUser.deleteOne({ _id: id });

    await writeAuditLog({
      ctx: adminCtx,
      req,
      action: "delete",
      entityType: "account",
      entityId: before.id,
      entityLabel: before.name || before.username,
      before,
      after: null,
      meta: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
