// src/app/api/admin/lunch/cancel-coupon/route.js
// POST { orderId } -> { ok, orderId, statusBefore, couponEffect, choiceType: "noFood" }
// R2a (R-e): ยกเลิกคูปอง + ตัวเลือกอาหารเป็น "ไม่รับอาหาร" ใน transaction เดียว
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { cancelCoupon } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await cancelCoupon({
      orderId: body?.orderId,
      adminId: ctx.userId,
      ctx,
      req,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
