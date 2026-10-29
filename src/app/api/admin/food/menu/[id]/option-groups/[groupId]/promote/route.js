import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { promoteGroupToSet } from "@/lib/foodOptionSets.server";

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

// POST /api/admin/food/menu/[id]/option-groups/[groupId]/promote  body: { name }
// OS-1: สร้างชุดจากกลุ่มของเมนูเอง แล้วผูกกลุ่มนั้นกับชุด (_id ในเมนูคงเดิม)
export async function POST(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const result = await promoteGroupToSet(
      String(params?.id || ""),
      String(params?.groupId || ""),
      body?.name,
    );

    await safeAudit({
      ctx,
      req,
      action: "food.option_set_promote",
      entityType: "FoodOptionSet",
      entityId: String(result.item._id),
      entityLabel: result.item.name,
      meta: {
        menuId: result.menu.id,
        groupId: result.groupId,
        restaurantId: String(result.item.restaurant),
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return jsonError(e);
  }
}
