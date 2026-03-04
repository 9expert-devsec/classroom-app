// src/app/api/merchant/coupon/redeem/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
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
  const spentAmount = Number(body?.spentAmount);

  if (!c) return jsonError("MISSING_CIPHER");
  if (!Number.isFinite(spentAmount) || spentAmount < 0)
    return jsonError("INVALID_SPENT_AMOUNT");

  let tokenRaw = "";
  try {
    tokenRaw = decryptCipher(c);
  } catch {
    return jsonError("BAD_CIPHER", 400);
  }

  const tokenHash = sha256(tokenRaw);

  await dbConnect();

  const now = new Date();

  // Atomic: ใช้ได้ครั้งเดียวเท่านั้น (status=issued AND merchantId=null)
  const updated = await CouponRecord.findOneAndUpdate(
    {
      redeemTokenHash: tokenHash,
      status: "issued",
      merchantId: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      // จำกัดร้าน (ถ้ามี)
      $or: [
        { allowedRestaurantIds: { $exists: false } },
        { allowedRestaurantIds: { $size: 0 } },
        { allowedRestaurantIds: me.restaurantId },
      ],
    },
    {
      $set: {
        status: "redeemed",
        merchantId: me.restaurantId,
        merchantUserId: me.userId,
        spentAmount,
        diffAmount: spentAmount - 180, // คูปอง 180 ตาม requirement
        redeemedAt: now,
      },
    },
    { new: true },
  );

  if (!updated) {
    // token ผิด / ใช้แล้ว / หมดอายุ / ร้านไม่อยู่ใน allowed
    return jsonError("COUPON_NOT_AVAILABLE", 409);
  }

  return NextResponse.json({
    ok: true,
    item: {
      displayCode: updated.displayCode,
      status: updated.status,
      couponPrice: updated.couponPrice || 180,
      spentAmount: updated.spentAmount || 0,
      diffAmount: updated.diffAmount || 0,
      redeemedAt: updated.redeemedAt || null,
      merchantId: String(updated.merchantId || ""),
    },
  });
}
