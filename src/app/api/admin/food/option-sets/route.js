import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { listOptionSets, createOptionSet } from "@/lib/foodOptionSets.server";

export const dynamic = "force-dynamic";

function jsonError(e) {
  return NextResponse.json(
    { ok: false, error: e?.message || "Server error", ...(e?.details ? { details: e.details } : {}) },
    { status: e?.status || 500 },
  );
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// OS-1: ชุดตัวเลือกของร้าน
// GET /api/admin/food/option-sets?restaurant=<id>  (รับ restaurantId ด้วย)
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();
    const sp = new URL(req.url).searchParams;
    const restaurantId = sp.get("restaurant") || sp.get("restaurantId") || "";
    const items = await listOptionSets(restaurantId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(e);
  }
}

// POST /api/admin/food/option-sets?restaurant=<id>  (restaurantId ใน body ใช้แทน query ได้)
// body: { name, selectType, required, minSelect, maxSelect, sortOrder, choices[{ name, priceDelta, isActive }] }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const sp = new URL(req.url).searchParams;
    const body = await req.json().catch(() => ({}));
    const restaurantId =
      sp.get("restaurant") || sp.get("restaurantId") || body?.restaurantId || "";
    const item = await createOptionSet(restaurantId, body);

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "FoodOptionSet",
      entityId: String(item._id),
      entityLabel: item.name,
      after: {
        name: item.name,
        selectType: item.selectType,
        required: !!item.required,
        minSelect: item.minSelect ?? null,
        maxSelect: item.maxSelect ?? null,
        choices: (item.choices || []).map((c) => c.name),
      },
      meta: { restaurantId: String(item.restaurant) },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e);
  }
}
