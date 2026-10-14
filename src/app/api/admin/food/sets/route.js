// src/app/api/admin/food/sets/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodSet from "@/models/FoodSet";
import { adminGuard, requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { validateSetName } from "@/lib/foodSet.server";

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

export async function GET(req) {
  const denied = await adminGuard(PERM.FOOD_READ);
  if (denied) return denied;

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  const filter = {};
  if (restaurantId) filter.restaurant = restaurantId;

  const items = await FoodSet.find(filter)
    .populate("restaurant", "name logoUrl")
    .lean();

  return NextResponse.json({ ok: true, items });
}

// POST body: { restaurant, name, menuIds }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const body = await req.json().catch(() => ({}));

    if (!body.restaurant) return jsonError("restaurant & name are required", 400);
    const name = await validateSetName({ restaurantId: body.restaurant, name: body.name });

    const set = await FoodSet.create({
      restaurant: body.restaurant,
      name,
      menuIds: body.menuIds || [],
    });

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "FoodSet",
      entityId: String(set._id),
      entityLabel: set.name,
      after: { name: set.name, menuIds: (set.menuIds || []).map(String) },
      meta: { restaurantId: String(body.restaurant) },
    });

    return NextResponse.json({ ok: true, item: set });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
