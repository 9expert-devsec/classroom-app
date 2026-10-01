// src/app/api/merchant/lunch/recent/route.js
// GET ?restaurantId= -> { items: [{ usedAt, nickname, name, code }] }  (วันนี้ ร้านนี้ ล่าสุด 10)
// C3c: ต้องมี header x-merchant-key (ไม่ตรง -> 404) · rate limit ร่วมกับ lookup
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { merchantKeyGuard, merchantNotFound } from "@/lib/merchantKey.server";
import { rateLimitGuard } from "@/lib/rateLimit.server";
import { getMerchantRestaurant, recentRedemptions } from "@/lib/merchantLunch.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  const denied = merchantKeyGuard(req);
  if (denied) return denied;

  try {
    await dbConnect();
    const limited = await rateLimitGuard(req, { bucket: "merchant.lookup", limit: 30 });
    if (limited) return limited;

    const { searchParams } = new URL(req.url);
    const restaurant = await getMerchantRestaurant(searchParams.get("restaurantId"));
    if (!restaurant) return merchantNotFound();

    const items = await recentRedemptions({ restaurantId: restaurant.id });
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/merchant/lunch/recent error:", err?.message || err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_STORE });
  }
}
