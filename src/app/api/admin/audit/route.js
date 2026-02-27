import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import AuditLog from "@/models/AuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function clean(x) {
  return String(x ?? "").trim();
}

export async function GET(req) {
  try {
    await requirePerm(PERM.AUDIT_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const entityType = clean(searchParams.get("entityType"));
    const entityId = clean(searchParams.get("entityId"));
    const action = clean(searchParams.get("action"));
    const q = clean(searchParams.get("q"));
    const limit = Math.min(
      200,
      Math.max(10, Number(searchParams.get("limit")) || 50),
    );

    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;

    if (q) {
      where.$or = [
        { "actor.name": { $regex: q, $options: "i" } },
        { "actor.username": { $regex: q, $options: "i" } },
        { entityLabel: { $regex: q, $options: "i" } },
      ];
    }

    const items = await AuditLog.find(where)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      items: items.map((x) => ({
        id: String(x._id),
        actor: x.actor,
        action: x.action,
        entityType: x.entityType,
        entityId: x.entityId,
        entityLabel: x.entityLabel,
        diffs: x.diffs || [],
        createdAt: x.createdAt,
      })),
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
