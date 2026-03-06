// src/app/api/merchant/bills/redeem/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";

import CouponRecord from "@/models/CouponRecord";
import Restaurant from "@/models/Restaurant";
import { requireMerchant } from "@/lib/merchantAuth.server";
import { decryptCipher, sha256 } from "@/lib/couponCipher.server";
import {
  getCouponDayYMD,
  getCouponEffectiveStatus,
} from "@/lib/couponExpiry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function cleanRef(x) {
  return clean(x).toUpperCase().replace(/\s+/g, "");
}

function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function todayYMD_BKK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function payMoreOf(billTotal, couponTotal) {
  const b = Number(billTotal);
  const c = Number(couponTotal);
  if (!Number.isFinite(b) || !Number.isFinite(c)) return 0;
  return Math.max(0, b - c);
}

function allowedRestaurantCond(restaurantId) {
  return {
    $or: [
      { allowedRestaurantIds: { $exists: false } },
      { allowedRestaurantIds: { $size: 0 } },
      { allowedRestaurantIds: restaurantId },
    ],
  };
}

export async function POST(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const body = await req.json().catch(() => ({}));

  const billCode = clean(body?.billCode);
  const billTotal = Number(body?.billTotal);
  const coupons = Array.isArray(body?.coupons) ? body.coupons : [];

  if (!billCode) return jsonError("MISSING_BILL_CODE");
  if (!Number.isFinite(billTotal) || billTotal < 0) {
    return jsonError("INVALID_BILL_TOTAL");
  }
  if (!coupons.length) return jsonError("MISSING_COUPONS");
  if (coupons.length > 10) return jsonError("TOO_MANY_COUPONS", 400);

  const want = [];
  const seenKey = new Set();

  for (const raw of coupons) {
    const c = clean(raw?.c);
    const ref = cleanRef(raw?.ref);

    if (c) {
      let tokenRaw = "";
      try {
        tokenRaw = decryptCipher(c);
      } catch {
        return jsonError("BAD_CIPHER", 400);
      }
      const tokenHash = sha256(tokenRaw);
      const k = `h:${tokenHash}`;
      if (seenKey.has(k)) continue;
      seenKey.add(k);
      want.push({ kind: "hash", tokenHash });
      continue;
    }

    if (ref) {
      const k = `r:${ref}`;
      if (seenKey.has(k)) continue;
      seenKey.add(k);
      want.push({ kind: "ref", ref });
      continue;
    }

    return jsonError("INVALID_COUPON_ITEM");
  }

  if (!want.length) return jsonError("NO_VALID_COUPONS");

  await dbConnect();
  const now = new Date();

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const or = want.map((x) =>
      x.kind === "hash"
        ? { redeemTokenHash: x.tokenHash }
        : { displayCode: x.ref },
    );

    const docs = await CouponRecord.find({ $or: or }).session(session);

    if (docs.length !== want.length) {
      throw new Error("COUPON_NOT_FOUND_SOME");
    }

    const billDayYMD = clean(getCouponDayYMD(docs[0])) || todayYMD_BKK();
    const courseName0 = clean(docs[0]?.courseName);
    const roomName0 = clean(docs[0]?.roomName);

    for (const d of docs) {
      const effectiveStatus = getCouponEffectiveStatus(d, now);
      const mid = d.merchantId ? String(d.merchantId) : "";

      if (effectiveStatus === "expired") {
        throw new Error("COUPON_EXPIRED");
      }

      if (effectiveStatus !== "issued" || mid) {
        throw new Error("COUPON_NOT_AVAILABLE");
      }

      const allowed = Array.isArray(d.allowedRestaurantIds)
        ? d.allowedRestaurantIds.map(String)
        : [];
      if (allowed.length > 0 && !allowed.includes(String(me.restaurantId))) {
        throw new Error("COUPON_NOT_ALLOWED_FOR_RESTAURANT");
      }

      if (clean(getCouponDayYMD(d)) !== billDayYMD) {
        throw new Error("COUPON_DIFF_DAY");
      }
      if (clean(d.courseName) !== courseName0) {
        throw new Error("COUPON_DIFF_COURSE");
      }
      if (clean(d.roomName) !== roomName0) {
        throw new Error("COUPON_DIFF_ROOM");
      }
    }

    const couponTotal = docs.reduce((a, d) => {
      const p = Number(d.couponPrice ?? 180);
      return a + (Number.isFinite(p) ? p : 180);
    }, 0);

    const payMore = payMoreOf(billTotal, couponTotal);
    const billCouponCount = docs.length;
    const redeemedAt = now;

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];

      const perSpent = i === 0 ? billTotal : 0;
      const perDiff = i === 0 ? payMore : 0;

      const res = await CouponRecord.updateOne(
        {
          _id: d._id,
          status: "issued",
          merchantId: null,
          $and: [allowedRestaurantCond(me.restaurantId)],
        },
        {
          $set: {
            status: "redeemed",
            merchantId: me.restaurantId,
            merchantUserId: me.userId,
            redeemedAt,

            spentAmount: perSpent,
            diffAmount: perDiff,

            billCode,
            billDayYMD,
            billTotal,
            billCouponTotal: couponTotal,
            billCouponCount,
            billPayMore: payMore,
          },
        },
        { session },
      );

      if (!res?.matchedCount) throw new Error("COUPON_CONFLICT");
    }

    await session.commitTransaction();

    const restaurant = await Restaurant.findById(me.restaurantId)
      .select("name")
      .lean();

    return NextResponse.json({
      ok: true,
      bill: {
        billCode,
        dayYMD: billDayYMD,
        courseName: courseName0,
        roomName: roomName0,
        couponCount: billCouponCount,
        couponTotal,
        billTotal,
        payMore,
        redeemedAt,
        merchantName: restaurant?.name || "",
        refs: docs.map((d) => d.displayCode),
      },
    });
  } catch (e) {
    try {
      await session.abortTransaction();
    } catch {}

    const msg = String(e?.message || "REDEEM_BILL_FAILED");

    if (
      [
        "COUPON_NOT_AVAILABLE",
        "COUPON_EXPIRED",
        "COUPON_NOT_ALLOWED_FOR_RESTAURANT",
        "COUPON_DIFF_DAY",
        "COUPON_DIFF_COURSE",
        "COUPON_DIFF_ROOM",
        "COUPON_CONFLICT",
        "COUPON_NOT_FOUND_SOME",
      ].includes(msg)
    ) {
      return jsonError(msg, 409);
    }

    return jsonError(msg, 500);
  } finally {
    session.endSession();
  }
}
