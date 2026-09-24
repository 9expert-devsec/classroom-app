// src/app/api/lunch/[token]/menu/route.js
//
// เมนูของร้านหนึ่งร้าน สำหรับวันของออเดอร์ใบนั้น
// เปิดได้เฉพาะร้านที่วันนั้นอยู่โหมด coupon เท่านั้น
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import FoodMenu from "@/models/FoodMenu";
import FoodMenuCategory from "@/models/FoodMenuCategory";

import { getOrderByToken } from "@/lib/lunchOrders.server";
import { getDaySet } from "@/lib/couponAvailability.server";

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

    // เมนูที่ร้านแจ้งว่าหมดเฉพาะวันนี้
    const soldOut = new Set(
      (entry.soldOutMenuIds || []).map((x) => String(x)),
    );

    const [categories, menus] = await Promise.all([
      FoodMenuCategory.find({ restaurant: restaurantId, isActive: { $ne: false } })
        .sort({ sortOrder: 1, createdAt: 1 })
        .select("name sortOrder")
        .lean(),
      FoodMenu.find({ restaurant: restaurantId, isActive: { $ne: false } })
        .sort({ sortOrder: 1, name: 1 })
        .select(
          "name imageUrl price description categoryIds sortOrder optionGroups",
        )
        .lean(),
    ]);

    return NextResponse.json(
      {
        restaurantId,
        dayYMD: ymd,
        categories: categories.map((c) => ({
          id: String(c._id),
          name: c.name || "",
        })),
        menus: menus.map((m) => ({
          id: String(m._id),
          name: m.name || "",
          image: m.imageUrl || "",
          price: m.price ?? null,
          description: m.description || "",
          categoryIds: (m.categoryIds || []).map((x) => String(x)),
          unavailableToday: soldOut.has(String(m._id)),
          optionGroups: (m.optionGroups || []).map((g) => ({
            id: String(g._id),
            name: g.name || "",
            required: !!g.required,
            selectType: g.selectType === "multi" ? "multi" : "single",
            choices: (g.choices || [])
              .filter((c) => c?.isActive !== false)
              .map((c) => ({
                id: String(c._id),
                name: c.name || "",
                priceDelta: c.priceDelta || 0,
              })),
          })),
        })),
      },
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
