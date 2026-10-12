// src/app/api/admin/food/coupon-stock/summary/route.js
// สรุปคลังคูปองของร้าน: นับตามสถานะ + แยกตามล็อต
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";
import Restaurant from "@/models/Restaurant";

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
      .select("name usesCouponStock couponStockLowThreshold")
      .lean();
    if (!restaurant) return jsonError("ไม่พบร้านอาหาร", 404);

    const today = toBkkYMD(new Date());
    const in7 = addDaysYMD_BKK(today, 7);

    const isAvailable = { $eq: ["$status", "available"] };

    // นับทุกอย่างใน aggregate เดียว
    const [facets] = await CouponStockCode.aggregate([
      { $match: { restaurant: restaurant._id } },
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          expiry: [
            {
              $group: {
                _id: null,
                availableNotExpired: {
                  $sum: {
                    $cond: [
                      { $and: [isAvailable, { $gte: ["$expiresYMD", today] }] },
                      1,
                      0,
                    ],
                  },
                },
                expiredStillAvailable: {
                  $sum: {
                    $cond: [
                      { $and: [isAvailable, { $lt: ["$expiresYMD", today] }] },
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
                          isAvailable,
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
                _id: { batch: "$importBatch", expiresYMD: "$expiresYMD" },
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
            { $sort: { "_id.expiresYMD": 1, "_id.batch": 1 } },
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

    const batches = byBatchRows.map((b) => ({
      importBatch: b._id.batch || "",
      expiresYMD: b._id.expiresYMD || "",
      total: b.total,
      available: b.available,
      assigned: b.assigned,
      handedOut: b.handedOut,
      awaitingReturn: b.awaitingReturn,
      voided: b.voided,
      lastImportedAt: b.lastImportedAt || null,
    }));

    const lowThreshold = Number(restaurant.couponStockLowThreshold ?? 5);

    return NextResponse.json({
      ok: true,
      restaurant: {
        _id: String(restaurant._id),
        name: restaurant.name,
        usesCouponStock: !!restaurant.usesCouponStock,
        couponStockLowThreshold: lowThreshold,
      },
      today,
      byStatus,
      availableNotExpired,
      expiredStillAvailable,
      expiringSoon,
      isLow: availableNotExpired <= lowThreshold,
      batches,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
