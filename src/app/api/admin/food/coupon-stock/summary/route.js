// src/app/api/admin/food/coupon-stock/summary/route.js
// สรุปคลังคูปองของร้าน: นับตามสถานะ + แยกตามล็อต
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";
import CouponStockLot from "@/models/CouponStockLot";
import { classifyStockCodes } from "@/lib/couponStockLots.server";
import Restaurant from "@/models/Restaurant";
import LunchOrder from "@/models/LunchOrder";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { toBkkYMD } from "@/lib/lunchConfig";
import { addDaysYMD_BKK } from "@/lib/classDates";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET /api/admin/food/coupon-stock/summary?restaurantId=
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const restaurantId = String(searchParams.get("restaurantId") || "").trim();
    if (!restaurantId) return jsonError("กรุณาระบุร้านอาหาร", 400);

    const restaurant = await Restaurant.findById(restaurantId)
      .select("name usesCouponStock couponStockLowThreshold stockFallbackToECoupon")
      .lean();
    if (!restaurant) return jsonError("ไม่พบร้านอาหาร", 404);

    const today = toBkkYMD(new Date());
    const in7 = addDaysYMD_BKK(today, 7);

    // R5-2: ล็อตเป็นตัวตั้ง (ชื่อ / วันหมดอายุ / สถานะ จากเอกสารล็อต)
    const lotDocs = await CouponStockLot.find({ restaurant: restaurant._id }).lean();
    const lotById = new Map(lotDocs.map((l) => [String(l._id), l]));
    const cancelledLotIds = lotDocs.filter((l) => l.status === "cancelled").map((l) => l._id);

    const isAvailable = { $eq: ["$status", "available"] };
    // ใบ available ของล็อตที่ถูกยกเลิกไม่นับเป็นของพร้อมใช้ (ปกติถูก void ไปแล้ว — กันไว้อีกชั้น)
    const inCancelledLot = { $in: ["$lotId", cancelledLotIds] };
    const isLiveAvailable = { $and: [isAvailable, { $not: [inCancelledLot] }] };

    // นับทุกอย่างใน aggregate เดียว
    const [facets] = await CouponStockCode.aggregate([
      { $match: { restaurant: restaurant._id } },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: { $cond: [{ $and: [isAvailable, inCancelledLot] }, "__cancelled_lot", "$status"] },
                n: { $sum: 1 },
              },
            },
          ],
          expiry: [
            {
              $group: {
                _id: null,
                availableNotExpired: {
                  $sum: {
                    $cond: [
                      { $and: [isLiveAvailable, { $gte: ["$expiresYMD", today] }] },
                      1,
                      0,
                    ],
                  },
                },
                expiredStillAvailable: {
                  $sum: {
                    $cond: [
                      { $and: [isLiveAvailable, { $lt: ["$expiresYMD", today] }] },
                      1,
                      0,
                    ],
                  },
                },
                expiringSoon: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          isLiveAvailable,
                          { $gte: ["$expiresYMD", today] },
                          { $lte: ["$expiresYMD", in7] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byBatch: [
            {
              $group: {
                // R5-2: 1 ล็อต = 1 การ์ด (รหัสในล็อตเดียวกันอาจมีวันหมดอายุต่างกันหลังแก้ล็อต)
                // รหัสที่ไม่มี lotId (ไม่ควรมีหลัง backfill) จัดกลุ่มแบบเดิม
                _id: {
                  lotId: "$lotId",
                  batch: { $cond: [{ $ifNull: ["$lotId", false] }, null, "$importBatch"] },
                  expiresYMD: { $cond: [{ $ifNull: ["$lotId", false] }, null, "$expiresYMD"] },
                },
                total: { $sum: 1 },
                available: { $sum: { $cond: [isAvailable, 1, 0] } },
                assigned: {
                  $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] },
                },
                handedOut: {
                  $sum: { $cond: [{ $eq: ["$status", "handed_out"] }, 1, 0] },
                },
                awaitingReturn: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "awaiting_return"] }, 1, 0],
                  },
                },
                voided: {
                  $sum: { $cond: [{ $eq: ["$status", "void"] }, 1, 0] },
                },
                lastImportedAt: { $max: "$createdAt" },
              },
            },
          ],
        },
      },
    ]);

    const byStatusRows = facets?.byStatus || [];
    const byBatchRows = facets?.byBatch || [];
    const {
      availableNotExpired = 0,
      expiredStillAvailable = 0,
      expiringSoon = 0,
    } = facets?.expiry?.[0] || {};

    const byStatus = {
      available: 0,
      assigned: 0,
      handed_out: 0,
      awaiting_return: 0,
      void: 0,
    };
    for (const r of byStatusRows) {
      if (r._id in byStatus) byStatus[r._id] = r.n;
    }

    // bucket ต่อล็อต: นอกจาก assigned ตัดสินจากสถานะได้เลย · assigned ต้องดูวันอบรมของออเดอร์
    const assignedCodes = await CouponStockCode.find({ restaurant: restaurant._id, status: "assigned" })
      .select("_id status orderId lotId")
      .lean();
    const assignedInfo = await classifyStockCodes(assignedCodes, today);
    const assignedByLot = new Map(); // lotKey -> { active, stale }
    for (const c of assignedCodes) {
      const k = String(c.lotId || "");
      if (!assignedByLot.has(k)) assignedByLot.set(k, { active: 0, stale: 0 });
      const i = assignedInfo.get(String(c._id));
      if (i?.staleAssigned) assignedByLot.get(k).stale += 1;
      else assignedByLot.get(k).active += 1;
    }

    const batches = byBatchRows
      .map((b) => {
        const lotId = b._id.lotId ? String(b._id.lotId) : null;
        const lot = lotId ? lotById.get(lotId) : null;
        const a = assignedByLot.get(lotId || "") || { active: 0, stale: 0 };
        return {
          importBatch: lot ? lot.name || "" : b._id.batch || "",
          expiresYMD: lot ? lot.expiresYMD || "" : b._id.expiresYMD || "",
          total: b.total,
          available: b.available,
          assigned: b.assigned,
          handedOut: b.handedOut,
          awaitingReturn: b.awaitingReturn,
          voided: b.voided,
          lastImportedAt: b.lastImportedAt || null,
          // R5-2: เพิ่ม (คีย์เดิมคงไว้)
          lotId,
          lotStatus: lot?.status || "",
          buckets: {
            unused: b.available + a.stale,
            void: b.voided,
            active: a.active,
            used: b.handedOut + b.awaitingReturn,
            staleAssigned: a.stale,
          },
        };
      })
      .sort(
        (x, y) =>
          (x.expiresYMD || "").localeCompare(y.expiresYMD || "") ||
          (x.importBatch || "").localeCompare(y.importBatch || ""),
      );

    const lowThreshold = Number(restaurant.couponStockLowThreshold ?? 5);

    // e-coupon ที่ออกแทนกระดาษวันนี้ (ไม่นับใบที่ยกเลิกไปแล้ว)
    const fallbackECouponToday = await LunchOrder.countDocuments({
      restaurantId: restaurant._id,
      dayYMD: today,
      usesCouponStock: true,
      couponSource: "ecoupon",
      status: { $in: ["ordered", "at_shop"] },
    });

    return NextResponse.json({
      ok: true,
      restaurant: {
        _id: String(restaurant._id),
        name: restaurant.name,
        usesCouponStock: !!restaurant.usesCouponStock,
        couponStockLowThreshold: lowThreshold,
        stockFallbackToECoupon: !!restaurant.stockFallbackToECoupon,
      },
      today,
      byStatus,
      availableNotExpired,
      expiredStillAvailable,
      expiringSoon,
      isLow: availableNotExpired <= lowThreshold,
      fallbackECouponToday,
      batches,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
