// src/app/api/lunch/[token]/coupon-status/route.js
//
// C2: สถานะคูปอง e-coupon แบบเบา ให้หน้าขอบคุณ/สแกนซ้ำ poll ทุก ~4 วินาที
//   200 { state: "unused" | "used" | "expired", usedAt?, serverTime }
//   404 invalid / 410 replaced / 409 not_ecoupon (ร้าน stock หรือยังไม่มีคูปอง)
//
// findOne ครั้งเดียวด้วย token (unique index) + projection เล็ก ๆ
// ไม่ดึงร้าน/สต็อก/เมนู และไม่ใช้ session API ตัวหนัก
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import LunchOrder from "@/models/LunchOrder";
import { couponStateOf, isECouponOrder } from "@/lib/lunchOrders.server";
import { lunchNow } from "@/lib/lunchClock.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req, { params }) {
  try {
    const token = String(params?.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "invalid" }, { status: 404, headers: NO_STORE });
    }

    await dbConnect();
    const order = await LunchOrder.findOne({ token })
      .select("status activeKey dayYMD couponSource couponCode redeemedAt")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "invalid" }, { status: 404, headers: NO_STORE });
    }
    if (order.status === "cancelled" || !order.activeKey) {
      return NextResponse.json({ error: "replaced" }, { status: 410, headers: NO_STORE });
    }
    if (!isECouponOrder(order)) {
      return NextResponse.json(
        { error: "not_ecoupon", reason: "not_ecoupon" },
        { status: 409, headers: NO_STORE },
      );
    }

    const now = lunchNow();
    return NextResponse.json(
      { ...couponStateOf(order, now), serverTime: now.toISOString() },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("GET /api/lunch/[token]/coupon-status error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
