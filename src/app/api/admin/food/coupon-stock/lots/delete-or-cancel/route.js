// src/app/api/admin/food/coupon-stock/lots/delete-or-cancel/route.js
// R5-2: ลบล็อต (ไม่เคยใช้) หรือ ยกเลิกรหัสที่เหลือ (เคยใช้) — server ตัดสินเองใน transaction
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { deleteOrCancelLot, capAuditIds, lotErrorResponse } from "@/lib/couponStockLots.server";

export const dynamic = "force-dynamic";

const MAX_REASON = 500;

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// POST { lotId, impactHash, reason? } -> { ok, decision: "delete" | "cancel", ... }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim().slice(0, MAX_REASON);
    const by = ctx?.user?.name || ctx?.user?.username || "";

    const out = await deleteOrCancelLot({
      lotId: String(body?.lotId || "").trim(),
      impactHash: String(body?.impactHash || ""),
      reason,
      by,
    });

    const lot = out.impact.lot;
    const label = lot.name || "(ไม่ระบุล็อต)";

    if (out.decision === "delete") {
      await safeAudit({
        ctx,
        req,
        action: "delete",
        entityType: "coupon_stock_lot",
        entityId: lot._id,
        entityLabel: label,
        before: {
          name: lot.name,
          expiresYMD: lot.expiresYMD,
          status: lot.status,
          note: out.lotBefore?.note || "",
          codes: out.codes.slice(0, 200),
          codeCount: out.codes.length,
        },
        meta: { stockAction: "lot_delete", restaurantId: lot.restaurant, reason },
      });
      return NextResponse.json({ ok: true, decision: "delete", deleted: out.codes.length });
    }

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "coupon_stock_lot",
      entityId: lot._id,
      entityLabel: label,
      before: { status: lot.status },
      after: { status: "cancelled", cancelReason: reason },
      meta: {
        stockAction: "lot_cancel",
        restaurantId: lot.restaurant,
        counts: out.impact.counts,
        voidedCodeIds: capAuditIds(out.voidedIds),
        stillAssigned: out.impact.cancel.stillAssigned,
        awaitingReturnOut: out.impact.cancel.awaitingReturnOut,
      },
    });

    return NextResponse.json({
      ok: true,
      decision: "cancel",
      voided: out.voidedIds.length,
      cancelledAt: out.cancelledAt,
      stillAssigned: out.impact.cancel.stillAssigned,
      awaitingReturnOut: out.impact.cancel.awaitingReturnOut,
    });
  } catch (e) {
    return lotErrorResponse(e);
  }
}
