import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";

export const dynamic = "force-dynamic";

// GET /api/admin/food/menus?restaurantId=xxx
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  const filter = {};
  if (restaurantId) filter.restaurant = restaurantId;

  const items = await FoodMenu.find(filter)
    .populate("restaurant")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ ok: true, items });
}

// POST body: { restaurantId, name, imageUrl, addons, drinks }
export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  const { restaurantId, name, imageUrl, addons, drinks } = body;

  if (!restaurantId || !name?.trim()) {
    return NextResponse.json(
      { error: "missing restaurantId or name" },
      { status: 400 }
    );
  }

  const item = await FoodMenu.create({
    restaurant: restaurantId,
    name: name.trim(),
    imageUrl: imageUrl || "",
    addons: Array.isArray(addons)
      ? addons.filter((x) => x.trim())
      : [],
    drinks: Array.isArray(drinks)
      ? drinks.filter((x) => x.trim())
      : [],
  });

  return NextResponse.json({ ok: true, item });
}
