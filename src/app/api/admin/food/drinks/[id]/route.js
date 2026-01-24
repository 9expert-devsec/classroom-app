import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  await dbConnect();
  const id = String(params?.id || "");
  if (!id)
    return NextResponse.json(
      { ok: false, error: "missing id" },
      { status: 400 },
    );

  const body = await req.json().catch(() => ({}));
  const { name, imageUrl, imagePublicId, isActive } = body || {};

  const update = {};
  if (name !== undefined) update.name = String(name || "").trim();
  if (imageUrl !== undefined) update.imageUrl = String(imageUrl || "").trim();
  if (imagePublicId !== undefined)
    update.imagePublicId = String(imagePublicId || "").trim();
  if (typeof isActive === "boolean") update.isActive = isActive;

  const doc = await FoodDrink.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();
  if (!doc)
    return NextResponse.json(
      { ok: false, error: "ไม่พบ drink" },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, item: doc });
}

export async function DELETE(_req, { params }) {
  await dbConnect();
  const id = String(params?.id || "");
  if (!id)
    return NextResponse.json(
      { ok: false, error: "missing id" },
      { status: 400 },
    );

  const doc = await FoodDrink.findByIdAndDelete(id).lean();
  if (!doc)
    return NextResponse.json(
      { ok: false, error: "ไม่พบ drink" },
      { status: 404 },
    );

  return NextResponse.json({ ok: true });
}
