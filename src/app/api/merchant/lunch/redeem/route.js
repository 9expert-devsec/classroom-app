// src/app/api/merchant/lunch/redeem/route.js
// POST { restaurantId, code, via: "scan"|"typed" }
//   -> { state: "used", usedAt, customer, redeemed: true }   ใช้สำเร็จครั้งนี้
//   -> { state: "used", usedAt, customer }                   ถูกใช้ไปก่อนแล้ว
//   -> { state: "expired" | "not_found" }
// C3c: atomic (findOneAndUpdate ครั้งเดียว) · x-merchant-key · rate limit 20/นาที/IP
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { merchantKeyGuard, merchantNotFound } from "@/lib/merchantKey.server";
import { rateLimitGuard } from "@/lib/rateLimit.server";
import { getMerchantRestaurant, redeemECoupon } from "@/lib/merchantLunch.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  const denied = merchantKeyGuard(req);
  if (denied) return denied;

  try {
    await dbConnect();
    const limited = await rateLimitGuard(req, { bucket: "merchant.redeem", limit: 20 });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const restaurant = await getMerchantRestaurant(body?.restaurantId);
    if (!restaurant) return merchantNotFound();

    const res = await redeemECoupon({
      restaurant,
      code: body?.code,
      via: body?.via,
      req,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    console.error("POST /api/merchant/lunch/redeem error:", err?.message || err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_STORE });
  }
}
