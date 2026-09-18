import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  await dbConnect();
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const body = await req.json();
  const { name, logoUrl, isActive, couponEnabled, couponLabel, couponAmount } =
    body || {};

  const update = {};
  if (name !== undefined) update.name = String(name).trim();
  if (logoUrl !== undefined) update.logoUrl = logoUrl || "";
  if (typeof isActive === "boolean") update.isActive = isActive;

  // ✅ coupon capability
  if (typeof couponEnabled === "boolean") update.couponEnabled = couponEnabled;
  if (couponLabel !== undefined)
    update.couponLabel = String(couponLabel || "").trim() || "Cash Coupon";
  if (couponAmount !== undefined) {
    const n = Number(couponAmount);
    update.couponAmount = Number.isFinite(n) && n >= 0 ? n : 0;
  }

  const item = await Restaurant.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!item) {
    return NextResponse.json({ error: "ไม่พบร้านอาหาร" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req, { params }) {
  await dbConnect();
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // ลบเมนูของร้านนี้ด้วย (กันข้อมูลค้าง)
  await FoodMenu.deleteMany({ restaurant: id });
  const result = await Restaurant.findByIdAndDelete(id).lean();

  if (!result) {
    return NextResponse.json({ error: "ไม่พบร้านอาหาร" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
