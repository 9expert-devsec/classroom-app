// src/app/api/admin/food/sets/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import FoodSet from "@/models/FoodSet";
import FoodDaySet from "@/models/FoodDaySet";
import { toBkkYMD } from "@/lib/lunchConfig";
import { adminGuard } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";

export const dynamic = "force-dynamic";

// GET -> { item, upcomingDays }: how many Food Calendar days from today on
// point at this set (shown before delete; delete itself is unchanged)
export async function GET(req, { params }) {
  const denied = await adminGuard(PERM.FOOD_READ);
  if (denied) return denied;

  await dbConnect();
  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "Set not found" }, { status: 404 });
  }

  const item = await FoodSet.findById(id).lean();
  if (!item) {
    return NextResponse.json({ ok: false, error: "Set not found" }, { status: 404 });
  }

  const upcomingDays = await FoodDaySet.countDocuments({
    "entries.set": item._id,
    dayYMD: { $gte: toBkkYMD(new Date()) },
  });

  return NextResponse.json({ ok: true, item, upcomingDays });
}

export async function PUT(req, { params }) {
  const denied = await adminGuard(PERM.FOOD_WRITE);
  if (denied) return denied;

  await dbConnect();
  const { id } = params;
  const body = await req.json();

  const updated = await FoodSet.findByIdAndUpdate(
    id,
    {
      $set: {
        name: body.name,
        menuIds: body.menuIds || [],
      },
    },
    { new: true }
  );

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Set not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(req, { params }) {
  const denied = await adminGuard(PERM.FOOD_WRITE);
  if (denied) return denied;

  await dbConnect();
  const { id } = params;

  await FoodSet.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
