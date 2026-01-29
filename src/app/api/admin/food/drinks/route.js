import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "restaurantId is required" },
      { status: 400 },
    );
  }

  const items = await FoodDrink.find({
    restaurant: restaurantId,
    isActive: { $ne: false },
  })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ ok: true, items });
}

export async function POST(req) {
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const { restaurantId, name, imageUrl, imagePublicId } = body || {};
  if (!restaurantId || !String(name || "").trim()) {
    return NextResponse.json(
      { ok: false, error: "restaurantId and name are required" },
      { status: 400 },
    );
  }

  const doc = await FoodDrink.create({
    restaurant: restaurantId,
    name: String(name).trim(),
    imageUrl: String(imageUrl || "").trim(),
    imagePublicId: String(imagePublicId || "").trim(),
  });

  return NextResponse.json({ ok: true, item: doc });
}
