import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  await dbConnect();
  const id = String(params?.id || "");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { name, imageUrl, isActive, restaurantId, addonIds, drinkIds } =
    body || {};

  const update = {};
  if (name !== undefined) update.name = String(name || "").trim();
  if (imageUrl !== undefined) update.imageUrl = String(imageUrl || "").trim();
  if (restaurantId) update.restaurant = restaurantId;
  if (typeof isActive === "boolean") update.isActive = isActive;

  // ✅ new: ids + sync legacy names
  if (addonIds !== undefined) {
    const addIds = Array.isArray(addonIds)
      ? addonIds.map(String).filter(Boolean)
      : [];
    update.addonIds = addIds;

    const addonDocs = addIds.length
      ? await FoodAddon.find({ _id: { $in: addIds } })
          .select("name")
          .lean()
      : [];
    update.addons = addonDocs.map((x) => x.name); // legacy
  }

  if (drinkIds !== undefined) {
    const drkIds = Array.isArray(drinkIds)
      ? drinkIds.map(String).filter(Boolean)
      : [];
    update.drinkIds = drkIds;

    const drinkDocs = drkIds.length
      ? await FoodDrink.find({ _id: { $in: drkIds } })
          .select("name")
          .lean()
      : [];
    update.drinks = drinkDocs.map((x) => x.name); // legacy
  }

  const item = await FoodMenu.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();
  if (!item) return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });

  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req, { params }) {
  await dbConnect();
  const id = String(params?.id || "");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const result = await FoodMenu.findByIdAndDelete(id).lean();
  if (!result)
    return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
