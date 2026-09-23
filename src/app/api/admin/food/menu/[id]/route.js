import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";
import FoodMenuCategory from "@/models/FoodMenuCategory";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  normalizeDescription,
  normalizeOptionGroups,
  normalizePrice,
  normalizeSortOrder,
  resolveCategoryIds,
} from "@/lib/foodMenuOptions.server";

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

export async function PUT(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { name, imageUrl, isActive, restaurantId, addonIds, drinkIds } =
      body || {};

    const before = await FoodMenu.findById(id).lean();
    if (!before)
      return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });

    const update = {};
    if (name !== undefined) update.name = String(name || "").trim();
    if (imageUrl !== undefined) update.imageUrl = String(imageUrl || "").trim();
    if (restaurantId) update.restaurant = restaurantId;
    if (typeof isActive === "boolean") update.isActive = isActive;

    // ✅ new: ids + sync legacy names
    if (addonIds !== undefined) {
      const addIds = Array.isArray(addonIds)
        ? addonIds.map(String).filter(Boolean)
        : [];
      update.addonIds = addIds;

      const addonDocs = addIds.length
        ? await FoodAddon.find({ _id: { $in: addIds } })
            .select("name")
            .lean()
        : [];
      update.addons = addonDocs.map((x) => x.name); // legacy
    }

    if (drinkIds !== undefined) {
      const drkIds = Array.isArray(drinkIds)
        ? drinkIds.map(String).filter(Boolean)
        : [];
      update.drinkIds = drkIds;

      const drinkDocs = drkIds.length
        ? await FoodDrink.find({ _id: { $in: drkIds } })
            .select("name")
            .lean()
        : [];
      update.drinks = drinkDocs.map((x) => x.name); // legacy
    }

    // ✅ lunch pre-order (P1b)
    // ฟิลด์ที่ไม่ได้ส่งมาใน body จะไม่ถูกแตะ (ของเดิมคงอยู่)
    const ownerRestaurantId = restaurantId || String(before.restaurant || "");

    // categoryIds คือของจริง; categoryId เดี่ยวรับไว้เพื่อ client เก่าเท่านั้น
    const rawCategories =
      body?.categoryIds !== undefined ? body.categoryIds : body?.categoryId;
    if (rawCategories !== undefined) {
      update.categoryIds = await resolveCategoryIds(
        rawCategories,
        ownerRestaurantId,
        FoodMenuCategory,
      );
    }
    if (body?.sortOrder !== undefined) {
      update.sortOrder = normalizeSortOrder(body.sortOrder);
    }
    if (body?.price !== undefined) update.price = normalizePrice(body.price);
    if (body?.description !== undefined) {
      update.description = normalizeDescription(body.description);
    }
    // _id ของกลุ่ม/ตัวเลือกที่ client ส่งกลับมาจะถูกคงไว้
    // มีเฉพาะรายการใหม่เท่านั้นที่ได้ _id ใหม่
    if (body?.optionGroups !== undefined) {
      update.optionGroups = normalizeOptionGroups(body.optionGroups);
    }

    const item = await FoodMenu.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "FoodMenu",
      entityId: String(id),
      entityLabel: item?.name || before?.name || "",
      before: {
        name: before.name,
        price: before.price ?? null,
        categoryIds: (before.categoryIds || []).map(String),
        sortOrder: before.sortOrder ?? 0,
        optionGroups: (before.optionGroups || []).length,
      },
      after: {
        name: item.name,
        price: item.price ?? null,
        categoryIds: (item.categoryIds || []).map(String),
        sortOrder: item.sortOrder ?? 0,
        optionGroups: (item.optionGroups || []).length,
      },
      meta: { restaurantId: String(item?.restaurant || "") },
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
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const result = await FoodMenu.findByIdAndDelete(id).lean();
    if (!result)
      return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "FoodMenu",
      entityId: String(id),
      entityLabel: result?.name || "",
      before: { name: result.name },
      meta: { restaurantId: String(result?.restaurant || "") },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
