// src/app/api/admin/food/coupon-stock/lots/restore/route.js
// R5-2: กู้ล็อตที่ถูกยกเลิก — คืนเฉพาะรหัสที่ถูก void เพราะการยกเลิกล็อต
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { restoreLot, capAuditIds, lotErrorResponse } from "@/lib/couponStockLots.server";

export const dynamic = "force-dynamic";

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// POST { lotId } -> { ok, restored, expiredWarning }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const out = await restoreLot({ lotId: String(body?.lotId || "").trim() });

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "coupon_stock_lot",
      entityId: out.lot._id,
      entityLabel: out.lot.name || "(ไม่ระบุล็อต)",
      before: out.lotBefore,
      after: { status: "active" },
      meta: {
        stockAction: "lot_restore",
        restoredCodeIds: capAuditIds(out.restoredIds),
        expiredWarning: out.expiredWarning,
      },
    });

    return NextResponse.json({
      ok: true,
      lot: out.lot,
      restored: out.restoredIds.length,
      expiredWarning: out.expiredWarning,
    });
  } catch (e) {
    return lotErrorResponse(e);
  }
}
