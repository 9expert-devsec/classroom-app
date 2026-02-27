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

export async function GET() {
  try {
    await requirePerm(PERM.ACCOUNTS_MANAGE);
    await dbConnect();

    const items = await AdminUser.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      ok: true,
      items: items.map((u) => ({
        id: String(u._id),
        username: u.username,
        name: u.name || "",
        roleCode: u.roleCode,
        avatarUrl: u.avatar?.url || "",
        isActive: !!u.isActive,
        lastLoginAt: u.lastLoginAt || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.ACCOUNTS_MANAGE);
    const body = await req.json();

    const username = clean(body?.username).toLowerCase();
    const name = clean(body?.name);
    const roleCode = clean(body?.roleCode).toUpperCase() || "OPS";
    const password = String(body?.password ?? "");

    if (!username) return jsonError("username required", 400);
    if (!password || password.length < 8)
      return jsonError("password ต้องอย่างน้อย 8 ตัวอักษร", 400);
    if (!["SA", "OPS", "EVT"].includes(roleCode))
      return jsonError("roleCode invalid", 400);

    await dbConnect();
    const exists = await AdminUser.findOne({ username }).lean();
    if (exists) return jsonError("username ซ้ำ", 409);

    const passwordHash = await hashPassword(password);

    const created = await AdminUser.create({
      username,
      name,
      roleCode,
      passwordHash,
      isActive: true,
    });

    const pub = created.toPublic();

    // ✅ audit log: create account (ไม่ log password)
    await writeAuditLog({
      ctx,
      req,
      action: "create",
      entityType: "account",
      entityId: pub.id,
      entityLabel: pub.name || pub.username,
      before: null,
      after: pub,
      meta: { createdRoleCode: roleCode },
    });

    return NextResponse.json({ ok: true, item: pub });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
