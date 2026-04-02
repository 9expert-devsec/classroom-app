import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import { requireMerchant } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function toInt(x, d = 10) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

function isYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(s));
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
  const todayFlag = ["1", "true", "yes"].includes(
    clean(searchParams.get("today")).toLowerCase(),
  );

  if (todayFlag) {
    const today = todayYMD_BKK();
    return { startYMD: today, endYMD: today };
  }

  const date = clean(searchParams.get("date"));
  if (isYMD(date)) {
    return { startYMD: date, endYMD: date };
  }

  const start = clean(searchParams.get("start"));
  const end = clean(searchParams.get("end"));

  if (isYMD(start) && isYMD(end)) {
    return start <= end
      ? { startYMD: start, endYMD: end }
      : { startYMD: end, endYMD: start };
  }

  return null;
}

export async function GET(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = toInt(searchParams.get("limit") || 10, 10);
  const range = resolveRange(searchParams);

  const where = {
    merchantId: me.restaurantId,
    status: "redeemed",
  };

  if (range?.startYMD && range?.endYMD) {
    where.redeemedAt = {
      $gte: startOfDayBKKToUTC(range.startYMD),
      $lte: endOfDayBKKToUTC(range.endYMD),
    };
  }

  const items = await CouponRecord.find(where)
    .sort({ redeemedAt: -1, _id: -1 })
    .limit(limit)
    .select(
      [
        "displayCode",
        "holderName",
        "courseName",
        "spentAmount",
        "diffAmount",
        "redeemedAt",
        "redeemCipher",
        "billCode",
        "billTotal",
        "billCouponTotal",
        "billCouponCount",
        "billPayMore",
      ].join(" "),
    )
    .lean();

  return NextResponse.json({
    ok: true,
    items: items.map((x) => ({
      id: String(x._id),
      displayCode: x.displayCode || "",
      holderName: x.holderName || "",
      courseName: x.courseName || "",
      spentAmount: x.spentAmount || 0,
      diffAmount: x.diffAmount || 0,
      redeemedAt: x.redeemedAt || null,
      redeemCipher: x.redeemCipher || "",

      billCode: x.billCode || "",
      billTotal: x.billTotal || 0,
      billCouponTotal: x.billCouponTotal || 0,
      billCouponCount: x.billCouponCount || 0,
      billPayMore: x.billPayMore || 0,
    })),
  });
}
