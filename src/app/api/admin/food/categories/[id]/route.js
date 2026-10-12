// src/app/api/admin/food/categories/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenuCategory from "@/models/FoodMenuCategory";
import FoodMenu from "@/models/FoodMenu";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { validateCategoryName } from "@/lib/foodMenuCategory.server";

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

// PATCH body: { name?, isActive?, sortOrder? }
export async function PATCH(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const id = String(params?.id || "");
    if (!id) return jsonError("missing id", 400);

    const body = await req.json().catch(() => ({}));

    const before = await FoodMenuCategory.findById(id).lean();
    if (!before) return jsonError("ไม่พบหมวดหมู่", 404);

    const update = {};

    if (body?.name !== undefined) {
      update.name = await validateCategoryName({
        restaurantId: before.restaurant,
        name: body.name,
        excludeId: id,
      });
    }
    if (typeof body?.isActive === "boolean") update.isActive = body.isActive;
    if (body?.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (Number.isFinite(n)) update.sortOrder = n;
    }

    if (Object.keys(update).length === 0) {
      return jsonError("ไม่มีข้อมูลที่ต้องการแก้ไข", 400);
    }

    const item = await FoodMenuCategory.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "FoodMenuCategory",
      entityId: String(id),
      entityLabel: item?.name || before?.name || "",
      before: {
        name: before.name,
        isActive: before.isActive,
        sortOrder: before.sortOrder,
      },
      after: {
        name: item.name,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      },
      meta: { restaurantId: String(before.restaurant || "") },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const id = String(params?.id || "");
    if (!id) return jsonError("missing id", 400);

    const before = await FoodMenuCategory.findById(id).lean();
    if (!before) return jsonError("ไม่พบหมวดหมู่", 404);

    // Menus are kept: only this category is removed from their categoryIds.
    // Pull first, then delete, so no menu is left pointing at a missing
    // category (resolveCategoryIds would reject it on the next menu save).
    const pulled = await FoodMenu.updateMany(
      { restaurant: before.restaurant, categoryIds: before._id },
      { $pull: { categoryIds: before._id } },
    );

    await FoodMenuCategory.findByIdAndDelete(id);

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "FoodMenuCategory",
      entityId: String(id),
      entityLabel: before?.name || "",
      before: { name: before.name, sortOrder: before.sortOrder },
      after: { removedFromMenus: pulled?.modifiedCount ?? 0 },
      meta: { restaurantId: String(before.restaurant || "") },
    });

    return NextResponse.json({
      ok: true,
      removedFromMenus: pulled?.modifiedCount ?? 0,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
