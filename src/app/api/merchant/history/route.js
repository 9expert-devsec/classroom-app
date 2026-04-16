// src/app/api/merchant/history/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import { requireMerchant } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(s));
}

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function todayYMD_BKK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function startOfDayBKKToUTC(ymd) {
  return new Date(`${ymd}T00:00:00.000+07:00`);
}

function endOfDayBKKToUTC(ymd) {
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

function resolveRange(searchParams) {
  const date = clean(searchParams.get("date"));
  const start = clean(searchParams.get("start"));
  const end = clean(searchParams.get("end"));

  // backward compatible: ?date=YYYY-MM-DD
  if (isYMD(date)) {
    return { startYMD: date, endYMD: date };
  }

  // new: ?start=YYYY-MM-DD&end=YYYY-MM-DD
  const startYMD = isYMD(start) ? start : "";
  const endYMD = isYMD(end) ? end : "";

  if (startYMD && endYMD) {
    if (startYMD <= endYMD) {
      return { startYMD, endYMD };
    }
    return { startYMD: endYMD, endYMD: startYMD };
  }

  // fallback: วันนี้
  const today = todayYMD_BKK();
  return { startYMD: today, endYMD: today };
}

function calcActualCouponUsedForBill(doc) {
  const billTotal = Math.max(0, toNum(doc?.billTotal, 0));
  const billPayMore = Math.max(0, toNum(doc?.billPayMore, 0));
  const billCouponTotal = Math.max(0, toNum(doc?.billCouponTotal, 0));

  // preferred: billTotal - payMore
  const fromPayMore = Math.max(0, billTotal - billPayMore);
  if (fromPayMore > 0) return fromPayMore;

  // fallback
  return Math.max(0, Math.min(billTotal, billCouponTotal));
}

function calcActualCouponUsedForLegacyRow(doc) {
  const spentAmount = Math.max(0, toNum(doc?.spentAmount, 0));
  const diffAmount = Math.max(0, toNum(doc?.diffAmount, 0));
  const couponPrice = Math.max(0, toNum(doc?.couponPrice, 180));

  // old single-row pattern: spent=bill total, diff=customer pay more
  const used = Math.max(0, spentAmount - diffAmount);
  return Math.max(0, Math.min(couponPrice, used || couponPrice));
}

/* ---------------- route ---------------- */

export async function GET(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const { searchParams } = new URL(req.url);
  const { startYMD, endYMD } = resolveRange(searchParams);

  if (!isYMD(startYMD) || !isYMD(endYMD)) {
    return jsonError("INVALID_DATE_RANGE", 400);
  }

  await dbConnect();

  const startAt = startOfDayBKKToUTC(startYMD);
  const endAt = endOfDayBKKToUTC(endYMD);

  const docs = await CouponRecord.find({
    merchantId: me.restaurantId,
    status: "redeemed",
    redeemedAt: {
      $gte: startAt,
      $lte: endAt,
    },
  })
    .sort({ redeemedAt: -1, _id: -1 })
    .select(
      [
        "displayCode",
        "holderName",
        "courseName",
        "roomName",
        "dayYMD",
        "couponPrice",
        "redeemedAt",
        "spentAmount",
        "diffAmount",
        "redeemCipher",
        "status",
        "billCode",
        "billTotal",
        "billCouponTotal",
        "billCouponCount",
        "billPayMore",
        "billDayYMD",
        "appliedAmount",
      ].join(" "),
    )
    .lean();

  let usedCount = 0;
  let couponAmount = 0;
  let totalAmount = 0;

  const countedBills = new Set();

  for (const doc of docs) {
    usedCount += 1;

    const billCode = clean(doc?.billCode);

    if (billCode) {
      if (countedBills.has(billCode)) continue;
      countedBills.add(billCode);

      couponAmount += calcActualCouponUsedForBill(doc);
      totalAmount += Math.max(0, toNum(doc?.billTotal, 0));
      continue;
    }

    // legacy row without billCode
    couponAmount += calcActualCouponUsedForLegacyRow(doc);
    totalAmount += Math.max(0, toNum(doc?.spentAmount, 0));
  }

  return NextResponse.json({
    ok: true,
    range: {
      start: startYMD,
      end: endYMD,
    },
    summary: {
      usedCount,
      couponAmount,
      totalAmount,
    },
    items: docs.map((doc) => ({
      id: String(doc._id),
      displayCode: doc.displayCode || "",
      holderName: doc.holderName || "",
      courseName: doc.courseName || "",
      roomName: doc.roomName || "",
      dayYMD: doc.dayYMD || "",
      couponPrice: toNum(doc.couponPrice, 180),

      redeemedAt: doc.redeemedAt || null,
      status: doc.status || "redeemed",

      spentAmount: toNum(doc.spentAmount, 0),
      diffAmount: toNum(doc.diffAmount, 0),
      redeemCipher: doc.redeemCipher || "",

      billCode: doc.billCode || "",
      billTotal: toNum(doc.billTotal, 0),
      billCouponTotal: toNum(doc.billCouponTotal, 0),
      billCouponCount: toNum(doc.billCouponCount, 0),
      billPayMore: toNum(doc.billPayMore, 0),
      billDayYMD: doc.billDayYMD || "",
      appliedAmount: doc.appliedAmount != null ? toNum(doc.appliedAmount, null) : null,
    })),
  });
}
