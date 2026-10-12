// src/app/api/admin/food/sets/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodSet from "@/models/FoodSet";
import { adminGuard } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";

export const dynamic = "force-dynamic";

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
