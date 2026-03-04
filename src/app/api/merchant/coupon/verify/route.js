// src/app/api/merchant/coupon/verify/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import Restaurant from "@/models/Restaurant";
import { requireMerchant } from "@/lib/merchantAuth.server";
import { decryptCipher, sha256 } from "@/lib/couponCipher.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}
function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const body = await req.json().catch(() => ({}));
  const c = clean(body?.c);
  if (!c) return jsonError("MISSING_CIPHER");

  let tokenRaw = "";
  try {
    tokenRaw = decryptCipher(c);
  } catch {
    return jsonError("BAD_CIPHER", 400);
  }

  const tokenHash = sha256(tokenRaw);

  await dbConnect();
  const it = await CouponRecord.findOne({ redeemTokenHash: tokenHash }).lean();
  if (!it) return jsonError("NOT_FOUND", 404);

  // จำกัดร้านที่ใช้ได้ (ถ้ามี)
  if (
    Array.isArray(it.allowedRestaurantIds) &&
    it.allowedRestaurantIds.length > 0
  ) {
    const ok = it.allowedRestaurantIds.some(
      (x) => String(x) === String(me.restaurantId),
    );
    if (!ok) return jsonError("NOT_ALLOWED_FOR_THIS_MERCHANT", 403);
  }

  let redeemedRestaurant = null;
  if (it.merchantId) {
    redeemedRestaurant = await Restaurant.findById(it.merchantId).lean();
  }

  const now = Date.now();
  const isExpired = it.expiresAt
    ? new Date(it.expiresAt).getTime() <= now
    : false;

  return NextResponse.json({
    ok: true,
    item: {
      displayCode: it.displayCode,
      status: isExpired && it.status === "issued" ? "expired" : it.status,
      holderName: it.holderName,
      courseName: it.courseName,
      roomName: it.roomName,
      dayYMD: it.dayYMD,
      couponPrice: it.couponPrice || 180,
      spentAmount: it.spentAmount || 0,
      diffAmount: it.diffAmount || 0,
      redeemedAt: it.redeemedAt || null,
      redeemedRestaurant: redeemedRestaurant
        ? { id: String(redeemedRestaurant._id), name: redeemedRestaurant.name }
        : null,
    },
  });
}
