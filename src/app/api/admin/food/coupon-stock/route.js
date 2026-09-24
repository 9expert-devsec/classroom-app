// src/app/api/admin/food/coupon-stock/route.js
// GET รายการคูปอง stock แบบแบ่งหน้า
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { normalizeStockCode } from "@/lib/couponStock.server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// escape ก่อนยัดเข้า regex กัน input แปลก ๆ ทำ query พัง
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/admin/food/coupon-stock?restaurantId=&status=&batch=&q=&page=1
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const restaurantId = String(searchParams.get("restaurantId") || "").trim();
    if (!restaurantId) return jsonError("กรุณาระบุร้านอาหาร", 400);

    const status = String(searchParams.get("status") || "").trim();
    const batch = String(searchParams.get("batch") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter = { restaurant: restaurantId };
    if (status) filter.status = status;
    if (batch) filter.importBatch = batch;
    if (q) {
      // ผู้ใช้อาจพิมพ์มาแบบมีช่องว่าง/ตัวเล็ก
      filter.code = { $regex: escapeRegex(normalizeStockCode(q)) };
    }

    const [items, total] = await Promise.all([
      CouponStockCode.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      CouponStockCode.countDocuments(filter),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
