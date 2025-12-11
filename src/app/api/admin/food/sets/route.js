// src/app/api/admin/food/sets/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodSet from "@/models/FoodSet";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  const filter = {};
  if (restaurantId) filter.restaurant = restaurantId;

  const items = await FoodSet.find(filter)
    .populate("restaurant", "name logoUrl")
    .lean();

  return NextResponse.json({ ok: true, items });
}

export async function POST(req) {
  await dbConnect();
  const body = await req.json();

  if (!body.restaurant || !body.name) {
    return NextResponse.json(
      { ok: false, error: "restaurant & name are required" },
      { status: 400 }
    );
  }

  const set = await FoodSet.create({
    restaurant: body.restaurant,
    name: body.name.trim(),
    menuIds: body.menuIds || [],
  });

  return NextResponse.json({ ok: true, item: set });
}
