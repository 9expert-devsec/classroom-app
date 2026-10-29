import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { detachGroupFromSet } from "@/lib/foodOptionSets.server";

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

// POST /api/admin/food/menu/[id]/option-groups/[groupId]/detach
// OS-1: กลุ่มเลิกผูกชุด กลายเป็นกลุ่มของเมนูเอง (ค่าปัจจุบันและ _id คงเดิม)
export async function POST(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const result = await detachGroupFromSet(
      String(params?.id || ""),
      String(params?.groupId || ""),
    );

    await safeAudit({
      ctx,
      req,
      action: "food.option_set_detach",
      entityType: "FoodMenu",
      entityId: result.menu.id,
      entityLabel: result.menu.name,
      meta: { groupId: result.groupId, setId: result.setId },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return jsonError(e);
  }
}
