// src/app/api/admin/food/coupon-stock/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  voidCode,
  unvoidCode,
  confirmReturn,
} from "@/lib/couponStock.server";

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

// PATCH { action: "void" | "unvoid" | "confirmReturn" | "note", reason?, note? }
export async function PATCH(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const id = String(params?.id || "");
    if (!id) return jsonError("missing id", 400);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    const before = await CouponStockCode.findById(id).lean();
    if (!before) return jsonError("ไม่พบคูปอง", 404);

    let item;

    if (action === "void") {
      item = await voidCode(id, body?.reason);
    } else if (action === "unvoid") {
      item = await unvoidCode(id);
    } else if (action === "confirmReturn") {
      item = await confirmReturn(id);
    } else if (action === "note") {
      item = await CouponStockCode.findByIdAndUpdate(
        id,
        { $set: { note: String(body?.note || "").trim() } },
        { new: true },
      ).lean();
    } else {
      return jsonError("action ไม่ถูกต้อง", 400);
    }

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "CouponStockCode",
      entityId: String(id),
      entityLabel: before.code,
      before: { status: before.status, note: before.note || "" },
      after: { status: item.status, note: item.note || "" },
      meta: { restaurantId: String(before.restaurant), stockAction: action },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// DELETE — ลบได้เฉพาะใบที่ยังไม่เคยถูกใช้เลย (แก้เคสพิมพ์ผิดตอน import)
export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const id = String(params?.id || "");
    if (!id) return jsonError("missing id", 400);

    const before = await CouponStockCode.findById(id).lean();
    if (!before) return jsonError("ไม่พบคูปอง", 404);

    if (before.status !== "available" || before.assignedAt) {
      return jsonError(
        "ลบได้เฉพาะคูปองที่สถานะ 'พร้อมใช้' และไม่เคยถูกผูกกับออเดอร์",
        409,
      );
    }

    await CouponStockCode.findByIdAndDelete(id);

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "CouponStockCode",
      entityId: String(id),
      entityLabel: before.code,
      before: {
        code: before.code,
        status: before.status,
        importBatch: before.importBatch || "",
      },
      meta: { restaurantId: String(before.restaurant) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
