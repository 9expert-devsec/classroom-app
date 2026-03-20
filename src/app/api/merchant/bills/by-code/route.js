import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import { requireMerchant } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const { searchParams } = new URL(req.url);
  const billCode = clean(searchParams.get("bill"));

  if (!billCode) return jsonError("MISSING_BILL_CODE", 400);

  await dbConnect();

  const docs = await CouponRecord.find({
    merchantId: me.restaurantId,
    billCode,
    status: "redeemed",
  })
    .sort({ redeemedAt: 1, _id: 1 })
    .select(
      "displayCode holderName courseName roomName dayYMD couponPrice redeemedAt spentAmount diffAmount status billCode billTotal billCouponTotal billCouponCount billPayMore billDayYMD",
    )
    .lean();

  if (!docs.length) {
    return jsonError("BILL_NOT_FOUND", 404);
  }

  const first = docs[0];

  const couponTotalFromRows = docs.reduce((sum, d) => {
    const p = Number(d.couponPrice ?? 180);
    return sum + (Number.isFinite(p) ? p : 180);
  }, 0);

  const bill = {
    billCode: first.billCode || billCode,
    dayYMD: first.billDayYMD || first.dayYMD || "",
    courseName: first.courseName || "",
    roomName: first.roomName || "",
    couponCount: Number(first.billCouponCount ?? docs.length) || docs.length,
    couponTotal:
      Number(first.billCouponTotal ?? couponTotalFromRows) ||
      couponTotalFromRows,
    billTotal: Number(first.billTotal ?? 0) || 0,
    payMore: Number(first.billPayMore ?? 0) || 0,
    redeemedAt: first.redeemedAt || null,
    refs: docs.map((d) => d.displayCode || "").filter(Boolean),
  };

  return NextResponse.json({
    ok: true,
    bill,
    items: docs.map((d) => ({
      id: String(d._id),
      displayCode: d.displayCode || "",
      holderName: d.holderName || "",
      courseName: d.courseName || "",
      roomName: d.roomName || "",
      dayYMD: d.dayYMD || "",
      couponPrice: d.couponPrice ?? 180,
      status: d.status || "redeemed",
      redeemedAt: d.redeemedAt || null,
      spentAmount: d.spentAmount ?? 0,
      diffAmount: d.diffAmount ?? 0,
    })),
  });
}
