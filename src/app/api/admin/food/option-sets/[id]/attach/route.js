import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { attachOptionSetToMenus } from "@/lib/foodOptionSets.server";

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

// POST /api/admin/food/option-sets/[id]/attach  body: { menuIds: [], replace?: [{ menuId, groupId }] }
// เมนูที่ผูกอยู่แล้วข้าม · มีเมนูของร้านอื่น = 400 ทั้งคำขอ
// replace (OS-2): ดึงกลุ่มของเมนูเองออกแล้วผูกชุดแทนใน transaction เดียวกัน
export async function POST(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const result = await attachOptionSetToMenus(String(params?.id || ""), body?.menuIds, {
      replace: body?.replace,
    });

    if (result.attached.length) {
      await safeAudit({
        ctx,
        req,
        action: "food.option_set_attach",
        entityType: "FoodOptionSet",
        entityId: result.set.id,
        entityLabel: result.set.name,
        meta: { attached: result.attached, skipped: result.skipped, replaced: result.replaced },
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return jsonError(e);
  }
}
