import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

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

export async function PUT(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const { id } = params || {};
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, logoUrl, isActive } = body || {};

    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (logoUrl !== undefined) update.logoUrl = logoUrl || "";
    if (typeof isActive === "boolean") update.isActive = isActive;

    const before = await Restaurant.findById(id).lean();
    if (!before) {
      return NextResponse.json({ error: "ไม่พบร้านอาหาร" }, { status: 404 });
    }

    const item = await Restaurant.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "Restaurant",
      entityId: String(id),
      entityLabel: item?.name || before?.name || "",
      before: { name: before.name, logoUrl: before.logoUrl, isActive: before.isActive },
      after: { name: item.name, logoUrl: item.logoUrl, isActive: item.isActive },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// PATCH: ตั้งค่าการใช้งานคูปองของร้าน
// กติกา: เปิด usesCouponStock ได้ก็ต่อเมื่อ couponEnabled เป็น true
//        ปิด couponEnabled แล้ว usesCouponStock เดิมคงไว้ (ไม่บังคับเป็น false)
//        ทุกจุดที่อ่าน usesCouponStock ของร้านต้องเช็ค couponEnabled ด้วย
export async function PATCH(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const { id } = params || {};
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      couponEnabled,
      usesCouponStock,
      couponStockLowThreshold,
      stockFallbackToECoupon,
    } = body || {};

    if (
      couponEnabled === undefined &&
      usesCouponStock === undefined &&
      couponStockLowThreshold === undefined &&
      stockFallbackToECoupon === undefined
    ) {
      return jsonError("ไม่มีข้อมูลที่ต้องการแก้ไข", 400);
    }
    if (couponEnabled !== undefined && typeof couponEnabled !== "boolean") {
      return jsonError("couponEnabled ต้องเป็น true/false", 400);
    }
    if (usesCouponStock !== undefined && typeof usesCouponStock !== "boolean") {
      return jsonError("usesCouponStock ต้องเป็น true/false", 400);
    }
    if (
      stockFallbackToECoupon !== undefined &&
      typeof stockFallbackToECoupon !== "boolean"
    ) {
      return jsonError("stockFallbackToECoupon ต้องเป็น true/false", 400);
    }

    const before = await Restaurant.findById(id).lean();
    if (!before) {
      return NextResponse.json({ error: "ไม่พบร้านอาหาร" }, { status: 404 });
    }

    const nextCouponEnabled =
      couponEnabled === undefined ? !!before.couponEnabled : couponEnabled;

    const nextUsesStock =
      usesCouponStock === undefined ? !!before.usesCouponStock : usesCouponStock;

    // บังคับกติกาไว้ที่ server เสมอ ไม่พึ่ง UI: เปิด stock ตอนร้านคูปองปิดอยู่ไม่ได้
    if (usesCouponStock === true && !nextCouponEnabled) {
      return jsonError("ต้องเปิดร้านคูปองก่อน จึงจะเปิดใช้คูปอง stock ได้", 400);
    }

    const update = {
      couponEnabled: nextCouponEnabled,
      usesCouponStock: nextUsesStock,
    };

    // คูปองกระดาษหมด -> ออก e-coupon แทน (มีความหมายเฉพาะร้าน stock)
    // ปิดทีหลังได้เสมอ — ออเดอร์ e-coupon ที่ออกไปแล้วยังใช้ได้ตามเดิม
    if (stockFallbackToECoupon !== undefined) {
      if (stockFallbackToECoupon === true && !nextUsesStock) {
        return jsonError("ต้องเปิดใช้คูปอง stock ก่อน จึงจะตั้งค่านี้ได้", 400);
      }
      update.stockFallbackToECoupon = stockFallbackToECoupon;
    }

    // ✅ P2: เกณฑ์เตือนคูปองเหลือน้อย
    if (couponStockLowThreshold !== undefined) {
      const n = Number(couponStockLowThreshold);
      if (!Number.isFinite(n) || n < 0) {
        return jsonError("เกณฑ์เตือนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป", 400);
      }
      update.couponStockLowThreshold = Math.floor(n);
    }

    const item = await Restaurant.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "Restaurant",
      entityId: String(id),
      entityLabel: item?.name || "",
      before: {
        couponEnabled: !!before.couponEnabled,
        usesCouponStock: !!before.usesCouponStock,
        couponStockLowThreshold: before.couponStockLowThreshold ?? 5,
        stockFallbackToECoupon: !!before.stockFallbackToECoupon,
      },
      after: {
        couponEnabled: !!item.couponEnabled,
        usesCouponStock: !!item.usesCouponStock,
        couponStockLowThreshold: item.couponStockLowThreshold ?? 5,
        stockFallbackToECoupon: !!item.stockFallbackToECoupon,
      },
      meta: { scope: "coupon-settings" },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const { id } = params || {};
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }

    // ลบเมนูของร้านนี้ด้วย (กันข้อมูลค้าง)
    await FoodMenu.deleteMany({ restaurant: id });
    const result = await Restaurant.findByIdAndDelete(id).lean();

    if (!result) {
      return NextResponse.json({ error: "ไม่พบร้านอาหาร" }, { status: 404 });
    }

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "Restaurant",
      entityId: String(id),
      entityLabel: result?.name || "",
      before: { name: result.name },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
