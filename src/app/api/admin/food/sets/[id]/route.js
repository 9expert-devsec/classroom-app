// src/app/api/admin/food/sets/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import FoodSet from "@/models/FoodSet";
import { adminGuard, requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { upcomingSetDays, validateSetName } from "@/lib/foodSet.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// GET -> { item, upcomingDays, upcomingDates }: Food Calendar days from
// today (Asia/Bangkok) on that use this set; any of them blocks delete
export async function GET(req, { params }) {
  const denied = await adminGuard(PERM.FOOD_READ);
  if (denied) return denied;

  await dbConnect();
  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) return jsonError("Set not found", 404);

  const item = await FoodSet.findById(id).lean();
  if (!item) return jsonError("Set not found", 404);

  const upcomingDates = await upcomingSetDays(item._id);
  return NextResponse.json({
    ok: true,
    item,
    upcomingDays: upcomingDates.length,
    upcomingDates,
  });
}

// PUT body: { name, menuIds }
export async function PUT(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError("Set not found", 404);

    const before = await FoodSet.findById(id).lean();
    if (!before) return jsonError("Set not found", 404);

    const body = await req.json().catch(() => ({}));
    const name = await validateSetName({
      restaurantId: before.restaurant,
      name: body.name,
      excludeId: before._id,
    });

    const updated = await FoodSet.findByIdAndUpdate(
      id,
      { $set: { name, menuIds: body.menuIds || [] } },
      { new: true },
    );

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "FoodSet",
      entityId: String(id),
      entityLabel: updated.name,
      before: { name: before.name, menuIds: (before.menuIds || []).map(String) },
      after: { name: updated.name, menuIds: (updated.menuIds || []).map(String) },
      meta: { restaurantId: String(before.restaurant || "") },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// DELETE: refused (409) while a Food Calendar day from today on uses the
// set; past days don't block. Response lists the blocking dates.
export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError("Set not found", 404);

    const before = await FoodSet.findById(id).lean();
    if (!before) return jsonError("Set not found", 404);

    const upcomingDates = await upcomingSetDays(before._id);
    if (upcomingDates.length > 0) {
      return jsonError(
        `ชุดนี้ถูกใช้ใน Food Calendar ${upcomingDates.length} วัน — เปลี่ยนชุดในวันดังกล่าวก่อนจึงจะลบได้`,
        409,
        { upcomingDates },
      );
    }

    await FoodSet.findByIdAndDelete(id);

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "FoodSet",
      entityId: String(id),
      entityLabel: before.name,
      before: { name: before.name, menuIds: (before.menuIds || []).map(String) },
      meta: { restaurantId: String(before.restaurant || "") },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
