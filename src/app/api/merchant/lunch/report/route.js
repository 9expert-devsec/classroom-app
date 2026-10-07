// src/app/api/merchant/lunch/report/route.js
// GET ?restaurantId=&range=today|week|month&page=N
//   -> { range: {label, fromISO, toISO, fromYMD, toYMD}, total, page, pageCount, rows[] }
// GET …&all=1 -> ทุกแถวในช่วง (สูงสุด 2000, เกิน -> truncated: true) + byDay (week/month) + generatedAt
// rows: { redeemedAt, nickname, name, room, code } — ไม่มีราคาใด ๆ
// C4: header x-merchant-key (ไม่ตรง -> 404) · rate limit · ร้านต้องเป็นร้าน Merchant (ไม่ใช่ stock)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { merchantKeyGuard, merchantNotFound } from "@/lib/merchantKey.server";
import { rateLimitGuard } from "@/lib/rateLimit.server";
import { getMerchantRestaurant } from "@/lib/merchantLunch.server";
import { REPORT_RANGES, reportPage, reportAll } from "@/lib/merchantReport.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  const denied = merchantKeyGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const range = String(searchParams.get("range") || "today");
    if (!REPORT_RANGES.includes(range)) {
      return NextResponse.json({ error: "invalid_range" }, { status: 400, headers: NO_STORE });
    }

    await dbConnect();
    const limited = await rateLimitGuard(req, { bucket: "merchant.report", limit: 30 });
    if (limited) return limited;

    const restaurant = await getMerchantRestaurant(searchParams.get("restaurantId"));
    if (!restaurant) return merchantNotFound();

    const data =
      searchParams.get("all") === "1"
        ? await reportAll({ restaurantId: restaurant.id, range })
        : await reportPage({ restaurantId: restaurant.id, range, page: searchParams.get("page") });

    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/merchant/lunch/report error:", err?.message || err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_STORE });
  }
}
