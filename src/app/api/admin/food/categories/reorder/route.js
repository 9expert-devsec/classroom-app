// src/app/api/admin/food/categories/reorder/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenuCategory from "@/models/FoodMenuCategory";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// POST body: { restaurantId, ids: [categoryId, ...] }  -> เขียน sortOrder 0..n
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "").trim();
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((x) => String(x || "")).filter(Boolean)
      : [];

    if (!restaurantId) return jsonError("กรุณาระบุร้านอาหาร", 400);
    if (ids.length === 0) return jsonError("ไม่มีรายการที่ต้องการจัดลำดับ", 400);

    // เรียงได้เฉพาะหมวดหมู่ของร้านนี้เท่านั้น
    const owned = await FoodMenuCategory.find({
      _id: { $in: ids },
      restaurant: restaurantId,
    })
      .select("_id")
      .lean();

    const ownedSet = new Set(owned.map((x) => String(x._id)));
    const finalIds = ids.filter((id) => ownedSet.has(id));

    if (finalIds.length !== ids.length) {
      return jsonError("มีหมวดหมู่ที่ไม่ได้อยู่ในร้านนี้", 400);
    }

    await FoodMenuCategory.bulkWrite(
      finalIds.map((id, i) => ({
        updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i } } },
      })),
    );

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "FoodMenuCategory",
      entityId: restaurantId,
      entityLabel: "จัดลำดับหมวดหมู่เมนู",
      after: { order: finalIds },
      meta: { restaurantId, scope: "reorder" },
    });

    return NextResponse.json({ ok: true, ids: finalIds });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
