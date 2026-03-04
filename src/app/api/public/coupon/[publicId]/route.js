// src/app/api/public/coupon/[publicId]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  await dbConnect();
  const { publicId } = await ctx.params;

  const it = await CouponRecord.findOne({ publicId }).lean();
  if (!it)
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 },
    );

  return NextResponse.json({
    ok: true,
    item: {
      publicId: it.publicId,
      displayCode: it.displayCode,
      status: it.status,
      holderName: it.holderName,
      courseName: it.courseName,
      roomName: it.roomName,
      dayYMD: it.dayYMD,
      couponPrice: it.couponPrice || 180,
      expiresAt: it.expiresAt || null,
      redeemCipher: it.redeemCipher, // เอาไว้ใช้สร้าง QR ให้ร้านสแกนในหน้า /coupon
      redeemedAt: it.redeemedAt || null,
      merchantId: it.merchantId ? String(it.merchantId) : null,
    },
  });
}
