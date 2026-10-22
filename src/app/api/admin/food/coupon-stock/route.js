// src/app/api/admin/food/coupon-stock/route.js
// GET รายการคูปอง stock แบบแบ่งหน้า
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import CouponStockCode from "@/models/CouponStockCode";
import CouponStockLot, { lotNameKey } from "@/models/CouponStockLot";

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

// GET /api/admin/food/coupon-stock?restaurantId=&status=&lotId=&batch=&expiresYMD=&expiry=&q=&sort=&page=1&pageSize=50
//   lotId              : R5-2 ทุกใบในล็อต (batch+expiresYMD ที่ตรงกับล็อตก็แปลงเป็น lotId ให้)
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

    // R5-2: เลือกล็อตด้วย lotId — หรือ batch+expiresYMD (การ์ดล็อตเดิม) ที่ตรงกับเอกสารล็อต
    // รหัสในล็อตเดียวกันอาจมีวันหมดอายุต่างกันหลังแก้ล็อต (ใบที่ใช้แล้วคงค่าเดิม) จึงต้องกรองด้วย lotId
    let lot = null;
    const lotIdParam = String(searchParams.get("lotId") || "").trim();
    if (lotIdParam && mongoose.isValidObjectId(lotIdParam)) {
      lot = await CouponStockLot.findOne({ _id: lotIdParam, restaurant: restaurantId }).select("_id").lean();
      if (!lot) return jsonError("ไม่พบล็อต", 404);
    } else if (batch && lotExpiresYMD && mongoose.isValidObjectId(restaurantId)) {
      const nameKey = batch === NO_BATCH ? "" : lotNameKey(batch);
      lot = await CouponStockLot.findOne({ restaurant: restaurantId, nameKey, expiresYMD: lotExpiresYMD })
        .select("_id")
        .lean();
    }

    // ระบุ lotId แล้วจะไม่กรองด้วยวันหมดอายุของล็อตอีก (expiry=soon/expired ยังกรองได้)
    let lotExpiryFilter = lotExpiresYMD;
    if (lot) {
      filter.lotId = lot._id;
      lotExpiryFilter = "";
    } else {
      if (batch === NO_BATCH) filter.importBatch = { $in: ["", null] };
      else if (batch) filter.importBatch = batch;
      if (lotExpiresYMD) filter.expiresYMD = lotExpiresYMD;
    }

    if (expiry === "soon" || expiry === "expired") {
      const today = toBkkYMD(new Date());
      // หมดอายุ / ใกล้หมดอายุ มีความหมายเฉพาะใบที่ยังไม่ได้ใช้
      if (!status) filter.status = "available";
      const range =
        expiry === "expired"
          ? { $lt: today }
          : { $gte: today, $lte: addDaysYMD_BKK(today, 7) };
      filter.expiresYMD = lotExpiryFilter
        ? { $eq: lotExpiryFilter, ...range }
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

    // R5-2: สถานะล็อตของแต่ละใบ (เพิ่ม field — ของเดิมไม่เปลี่ยน)
    const lotIds = [...new Set(items.map((it) => String(it.lotId || "")).filter(Boolean))];
    const lotStatus = new Map(
      (lotIds.length
        ? await CouponStockLot.find({ _id: { $in: lotIds } }).select("_id status").lean()
        : []
      ).map((l) => [String(l._id), l.status]),
    );
    for (const it of items) it.lotStatus = lotStatus.get(String(it.lotId || "")) || "";

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
