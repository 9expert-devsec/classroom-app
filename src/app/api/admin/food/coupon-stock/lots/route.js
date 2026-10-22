// src/app/api/admin/food/coupon-stock/lots/route.js
// R5-2: แก้ชื่อ / วันหมดอายุของล็อตคูปองกระดาษ — ต้องผ่าน /lots/impact ก่อน (impactHash)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { editLot, capAuditIds, lotErrorResponse } from "@/lib/couponStockLots.server";

export const dynamic = "force-dynamic";

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

function optStr(v) {
  return v === undefined || v === null ? undefined : String(v);
}

// PATCH { lotId, newName?, newExpiresYMD?, impactHash }
export async function PATCH(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const out = await editLot({
      lotId: String(body?.lotId || "").trim(),
      newName: optStr(body?.newName),
      newExpiresYMD: optStr(body?.newExpiresYMD)?.trim(),
      impactHash: String(body?.impactHash || ""),
    });

    const { impact } = out;
    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "coupon_stock_lot",
      entityId: impact.lot._id,
      entityLabel: out.after.name || "(ไม่ระบุล็อต)",
      before: out.before,
      after: out.after,
      meta: {
        stockAction: "lot_edit",
        restaurantId: impact.lot.restaurant,
        counts: impact.counts,
        changedCodeIds: capAuditIds(out.changedCodeIds),
        warnings: impact.warnings.map((w) => w.code),
      },
    });

    return NextResponse.json({
      ok: true,
      lot: { ...impact.lot, ...out.after },
      changed: out.changedCodeIds.length,
      counts: impact.counts,
      warnings: impact.warnings,
    });
  } catch (e) {
    return lotErrorResponse(e);
  }
}
