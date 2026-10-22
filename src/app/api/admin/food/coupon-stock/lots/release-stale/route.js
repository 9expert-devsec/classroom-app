// src/app/api/admin/food/coupon-stock/lots/release-stale/route.js
// R5-3d: รับคืนคูปองกระดาษที่ค้างจอง (วันเรียนผ่านไปแล้ว ผู้เรียนไม่มารับ) เข้าคลัง — แอดมินกดเองเมื่อได้กระดาษคืน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { capAuditIds, lotErrorResponse, releaseStaleCodes } from "@/lib/couponStockLots.server";

export const dynamic = "force-dynamic";

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// POST { lotId, codeIds: [] } -> { ok, released, available, voided, results }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const out = await releaseStaleCodes({
      lotId: String(body?.lotId || "").trim(),
      codeIds: body?.codeIds,
      by: ctx?.user?.name || ctx?.user?.username || "",
    });

    const available = out.results.filter((r) => r.result === "available").length;
    const voided = out.results.filter((r) => r.result === "void").length;

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "coupon_stock_lot",
      entityId: out.lot._id,
      entityLabel: out.lot.name || "(ไม่ระบุล็อต)",
      meta: {
        stockAction: "lot_release_stale",
        restaurantId: out.lot.restaurant,
        lotStatus: out.lot.status,
        codeIds: capAuditIds(out.results.map((r) => r.codeId)),
        orderIds: capAuditIds(out.results.map((r) => r.orderId)),
        results: out.results.slice(0, 200).map((r) => ({ code: r.code, dayYMD: r.dayYMD, result: r.result })),
        available,
        voided,
      },
    });

    return NextResponse.json({
      ok: true,
      released: out.results.length,
      available,
      voided,
      results: out.results,
    });
  } catch (e) {
    return lotErrorResponse(e);
  }
}
