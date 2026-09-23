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
  resolveCategoryId,
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

// GET /api/admin/food/menu?restaurantId=xxx
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    const filter = {};
    if (restaurantId) filter.restaurant = restaurantId;

    const items = await FoodMenu.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// POST body: { restaurantId, name, imageUrl, addonIds, drinkIds,
//              categoryId, sortOrder, price, description, optionGroups }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { restaurantId, name, imageUrl, addonIds, drinkIds } = body || {};

    if (!restaurantId || !String(name || "").trim()) {
      return NextResponse.json(
        { error: "missing restaurantId or name" },
        { status: 400 },
      );
    }

    const addIds = Array.isArray(addonIds)
      ? addonIds.map(String).filter(Boolean)
      : [];
    const drkIds = Array.isArray(drinkIds)
      ? drinkIds.map(String).filter(Boolean)
      : [];

    // ✅ sync legacy names
    const addonDocs = addIds.length
      ? await FoodAddon.find({ _id: { $in: addIds } })
          .select("name")
          .lean()
      : [];
    const drinkDocs = drkIds.length
      ? await FoodDrink.find({ _id: { $in: drkIds } })
          .select("name")
          .lean()
      : [];

    const doc = {
      restaurant: restaurantId,
      name: String(name).trim(),
      imageUrl: String(imageUrl || "").trim(),

      // new
      addonIds: addIds,
      drinkIds: drkIds,

      // legacy
      addons: addonDocs.map((x) => x.name),
      drinks: drinkDocs.map((x) => x.name),
    };

    // ✅ lunch pre-order (P1b) — ฟิลด์ที่ไม่ได้ส่งมา ปล่อยให้ใช้ default ของ schema
    if (body?.categoryId !== undefined) {
      doc.categoryId = await resolveCategoryId(
        body.categoryId,
        restaurantId,
        FoodMenuCategory,
      );
    }
    if (body?.sortOrder !== undefined) doc.sortOrder = normalizeSortOrder(body.sortOrder);
    if (body?.price !== undefined) doc.price = normalizePrice(body.price);
    if (body?.description !== undefined) {
      doc.description = normalizeDescription(body.description);
    }
    if (body?.optionGroups !== undefined) {
      doc.optionGroups = normalizeOptionGroups(body.optionGroups);
    }

    const item = await FoodMenu.create(doc);

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "FoodMenu",
      entityId: String(item._id),
      entityLabel: item.name,
      after: {
        name: item.name,
        price: item.price,
        categoryId: String(item.categoryId || ""),
        sortOrder: item.sortOrder,
        optionGroups: (item.optionGroups || []).length,
      },
      meta: { restaurantId: String(restaurantId) },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
