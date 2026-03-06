// src/app/api/merchant/coupons/by-ref/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireMerchant } from "@/lib/merchantAuth.server"; // ถ้าชื่อไฟล์คุณต่าง ให้เปลี่ยนตามจริง
import CouponRecord from "@/models/CouponRecord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function normRef(x) {
  return clean(x).toUpperCase().replace(/\s+/g, "");
}

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req) {
  const merchant = await requireMerchant(req);
  if (merchant instanceof NextResponse) return merchant;

  await dbConnect();

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const ref = normRef(body?.ref);
  if (!ref) return jsonError("Missing ref", 400);

  // ✅ lock ร้าน: ค้นหาเฉพาะคูปองที่อนุญาตร้านนี้
  // ปกติ CouponRecord จะมี allowedMerchantIds หรือ merchantIds อะไรสักอย่าง
  // แต่ถ้าในระบบคุณใช้แนวทาง:
  //  - coupon ใช้ได้ทั้ง 2 ร้าน และ redeem จริงจะ enforce ตอน redeem
  // ก็หาได้ทั่วระบบก่อน แล้วค่อย check "allowed" ตรงนี้ (ถ้ามี field)

  const item = await CouponRecord.findOne({ displayCode: ref })
    .select(
      "displayCode redeemCipher status holderName courseName roomName couponPrice merchantId redeemedAt",
    )
    .lean();

  if (!item) return jsonError("NOT_FOUND", 404);
  if (!item.redeemCipher) return jsonError("NO_REDEEM_CIPHER", 400);

  return NextResponse.json({
    ok: true,
    item: {
      displayCode: item.displayCode || "",
      redeemCipher: item.redeemCipher,
      status: item.status || "",
      holderName: item.holderName || "",
      courseName: item.courseName || "",
      roomName: item.roomName || "",
      couponPrice: item.couponPrice ?? 180,
      redeemedAt: item.redeemedAt || null,
    },
  });
}
