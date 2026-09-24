// src/app/api/lunch/[token]/menu/route.js
//
// เมนูของร้านหนึ่งร้าน สำหรับวันของออเดอร์ใบนั้น
// เปิดได้เฉพาะร้านที่วันนั้นอยู่โหมด coupon เท่านั้น
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { getOrderByToken } from "@/lib/lunchOrders.server";
import { getDaySet } from "@/lib/couponAvailability.server";
import { loadRestaurantMenu } from "@/lib/lunchMenu.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const token = String(params?.token || "");
    const order = await getOrderByToken(token);

    if (!order) {
      return NextResponse.json(
        { error: "invalid" },
        { status: 404, headers: NO_STORE },
      );
    }
    if (order.status === "cancelled" || !order.activeKey) {
      return NextResponse.json(
        { error: "replaced" },
        { status: 410, headers: NO_STORE },
      );
    }

    const { searchParams } = new URL(req.url);
    const restaurantId = String(searchParams.get("restaurantId") || "").trim();
    if (!restaurantId) {
      return NextResponse.json(
        { error: "invalid" },
        { status: 404, headers: NO_STORE },
      );
    }

    const ymd = order.dayYMD;
    const daySet = await getDaySet(ymd);

    const entry = (daySet?.entries || []).find(
      (e) => String(e.restaurant) === restaurantId,
    );

    // ต้องเป็นร้านโหมด coupon ของวันนั้นเท่านั้น
    if (!entry || entry.mode !== "coupon") {
      return NextResponse.json(
        { error: "invalid" },
        { status: 404, headers: NO_STORE },
      );
    }

    const { categories, menus } = await loadRestaurantMenu({ daySet, restaurantId });

    return NextResponse.json(
      { restaurantId, dayYMD: ymd, categories, menus },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("GET /api/lunch/[token]/menu error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
