import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

// GET /api/admin/food/menu?restaurantId=xxx
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  const filter = {};
  if (restaurantId) filter.restaurant = restaurantId;

  const items = await FoodMenu.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ ok: true, items });
}

// POST body: { restaurantId, name, imageUrl, addonIds, drinkIds }
export async function POST(req) {
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const { restaurantId, name, imageUrl, addonIds, drinkIds } = body || {};

  if (!restaurantId || !String(name || "").trim()) {
    return NextResponse.json(
      { error: "missing restaurantId or name" },
      { status: 400 },
    );
  }

  const addIds = Array.isArray(addonIds)
    ? addonIds.map(String).filter(Boolean)
    : [];
  const drkIds = Array.isArray(drinkIds)
    ? drinkIds.map(String).filter(Boolean)
    : [];

  // ✅ sync legacy names
  const addonDocs = addIds.length
    ? await FoodAddon.find({ _id: { $in: addIds } })
        .select("name")
        .lean()
    : [];
  const drinkDocs = drkIds.length
    ? await FoodDrink.find({ _id: { $in: drkIds } })
        .select("name")
        .lean()
    : [];

  const item = await FoodMenu.create({
    restaurant: restaurantId,
    name: String(name).trim(),
    imageUrl: String(imageUrl || "").trim(),

    // new
    addonIds: addIds,
    drinkIds: drkIds,

    // legacy
    addons: addonDocs.map((x) => x.name),
    drinks: drinkDocs.map((x) => x.name),
  });

  return NextResponse.json({ ok: true, item });
}
