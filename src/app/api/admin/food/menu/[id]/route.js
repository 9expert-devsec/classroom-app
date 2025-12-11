import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  await dbConnect();
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const body = await req.json();
  let { name, imageUrl, addons, drinks, isActive, restaurantId } = body || {};

  const update = {};

  if (name !== undefined) update.name = String(name).trim();
  if (imageUrl !== undefined) update.imageUrl = imageUrl || "";
  if (restaurantId) update.restaurant = restaurantId;

  // รองรับทั้งส่งมาเป็น string หรือ array (เผื่อใช้ที่อื่นในอนาคต)
  if (addons !== undefined) {
    if (Array.isArray(addons)) {
      update.addons = addons.map((x) => String(x).trim()).filter(Boolean);
    } else {
      update.addons = String(addons)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  if (drinks !== undefined) {
    if (Array.isArray(drinks)) {
      update.drinks = drinks.map((x) => String(x).trim()).filter(Boolean);
    } else {
      update.drinks = String(drinks)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  if (typeof isActive === "boolean") update.isActive = isActive;

  const item = await FoodMenu.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!item) {
    return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req, { params }) {
  await dbConnect();
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const result = await FoodMenu.findByIdAndDelete(id).lean();

  if (!result) {
    return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
