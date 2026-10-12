// src/app/api/admin/food/coupon-stock/route.js
// GET รายการคูปอง stock แบบแบ่งหน้า
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { normalizeStockCode } from "@/lib/couponStock.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { addDaysYMD_BKK } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const NO_BATCH = "__none__";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// escape ก่อนยัดเข้า regex กัน input แปลก ๆ ทำ query พัง
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/admin/food/coupon-stock?restaurantId=&status=&batch=&expiresYMD=&expiry=&q=&sort=&page=1&pageSize=50
//   batch=__none__     : เฉพาะใบที่ไม่ระบุล็อต
//   expiry=soon        : พร้อมใช้และหมดอายุภายใน 7 วัน
//   expiry=expired     : พร้อมใช้แต่หมดอายุแล้ว
//   sort=expires_asc | expires_desc (ไม่ส่ง = นำเข้าล่าสุดก่อน)
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const restaurantId = String(searchParams.get("restaurantId") || "").trim();
    if (!restaurantId) return jsonError("กรุณาระบุร้านอาหาร", 400);

    const status = String(searchParams.get("status") || "").trim();
    const batch = String(searchParams.get("batch") || "").trim();
    const lotExpiresYMD = String(searchParams.get("expiresYMD") || "").trim();
    const expiry = String(searchParams.get("expiry") || "").trim();
    const sort = String(searchParams.get("sort") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const askedSize = Number(searchParams.get("pageSize") || PAGE_SIZE);
    const pageSize = PAGE_SIZE_OPTIONS.includes(askedSize) ? askedSize : PAGE_SIZE;

    const filter = { restaurant: restaurantId };
    if (status) filter.status = status;
    if (batch === NO_BATCH) filter.importBatch = { $in: ["", null] };
    else if (batch) filter.importBatch = batch;
    if (lotExpiresYMD) filter.expiresYMD = lotExpiresYMD;

    if (expiry === "soon" || expiry === "expired") {
      const today = toBkkYMD(new Date());
      // หมดอายุ / ใกล้หมดอายุ มีความหมายเฉพาะใบที่ยังไม่ได้ใช้
      if (!status) filter.status = "available";
      const range =
        expiry === "expired"
          ? { $lt: today }
          : { $gte: today, $lte: addDaysYMD_BKK(today, 7) };
      filter.expiresYMD = lotExpiresYMD
        ? { $eq: lotExpiresYMD, ...range }
        : range;
    }

    if (q) {
      // รหัส: ผู้ใช้อาจพิมพ์มาแบบมีช่องว่าง/ตัวเล็ก — ล็อต/หมายเหตุ: ค้นแบบไม่สนตัวพิมพ์
      const loose = { $regex: escapeRegex(q), $options: "i" };
      const or = [{ importBatch: loose }, { note: loose }];
      const code = normalizeStockCode(q);
      if (code) or.unshift({ code: { $regex: escapeRegex(code) } });
      filter.$or = or;
    }

    const sortSpec =
      sort === "expires_asc"
        ? { expiresYMD: 1, code: 1, _id: 1 }
        : sort === "expires_desc"
          ? { expiresYMD: -1, code: 1, _id: 1 }
          : { createdAt: -1, _id: -1 };

    const [items, total] = await Promise.all([
      CouponStockCode.find(filter)
        .sort(sortSpec)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      CouponStockCode.countDocuments(filter),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
