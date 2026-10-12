// src/app/api/admin/food/categories/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenuCategory from "@/models/FoodMenuCategory";

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

// GET /api/admin/food/categories?restaurantId=xxx
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    const filter = {};
    if (restaurantId) filter.restaurant = restaurantId;

    const items = await FoodMenuCategory.find(filter)
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// POST body: { restaurantId, name, sortOrder?, isActive?, highlight? }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "").trim();

    if (!restaurantId) return jsonError("กรุณาระบุร้านอาหาร", 400);
    const name = await validateCategoryName({
      restaurantId,
      name: body?.name,
    });

    // ไม่ส่งลำดับมา = ต่อท้ายรายการเดิม
    let sortOrder = Number(body?.sortOrder);
    if (body?.sortOrder === undefined || body?.sortOrder === "" || !Number.isFinite(sortOrder)) {
      const last = await FoodMenuCategory.findOne({ restaurant: restaurantId })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
      sortOrder = Number.isFinite(last?.sortOrder) ? last.sortOrder + 1 : 0;
    }

    const item = await FoodMenuCategory.create({
      restaurant: restaurantId,
      name,
      sortOrder,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
      ...(typeof body?.highlight === "boolean" ? { highlight: body.highlight } : {}),
    });

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "FoodMenuCategory",
      entityId: String(item._id),
      entityLabel: item.name,
      after: {
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        highlight: item.highlight ?? null,
      },
      meta: { restaurantId },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
