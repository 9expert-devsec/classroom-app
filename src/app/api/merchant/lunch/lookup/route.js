// src/app/api/merchant/lunch/lookup/route.js
// POST { restaurantId, code } -> { state: "unused"|"used"|"expired"|"not_found", customer?, usedAt? }
// C3c: ต้องมี header x-merchant-key (ไม่ตรง -> 404) · rate limit 30/นาที/IP · ไม่มีราคาใด ๆ
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { merchantKeyGuard, merchantNotFound } from "@/lib/merchantKey.server";
import { rateLimitGuard } from "@/lib/rateLimit.server";
import { getMerchantRestaurant, lookupECoupon } from "@/lib/merchantLunch.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  const denied = merchantKeyGuard(req);
  if (denied) return denied;

  try {
    await dbConnect();
    const limited = await rateLimitGuard(req, { bucket: "merchant.lookup", limit: 30 });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const restaurant = await getMerchantRestaurant(body?.restaurantId);
    if (!restaurant) return merchantNotFound();

    const res = await lookupECoupon({ restaurantId: restaurant.id, code: body?.code });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    console.error("POST /api/merchant/lunch/lookup error:", err?.message || err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_STORE });
  }
}
