// src/app/api/admin/lunch/reassign/route.js
// POST { learners: [{ studentId, classId }], date, targetRestaurantId, reason? }
//   -> { ok, dayYMD, target, moved: [{ name, fromRestaurantName, toRestaurantName, oldCouponCode, newCouponCode, ... }] }
//   ไม่ผ่าน -> { error, reason } (+ needed / available เมื่อคูปองกระดาษไม่พอ) และไม่มีใครถูกโยก
// R3: โยกผู้เรียน (คูปอง) ไปร้านอื่น — ทั้งชุดใน transaction เดียว (lunchActions.reassignLunchCoupon)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { reassignLunchCoupon } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await reassignLunchCoupon({
      learners: body?.learners,
      date: body?.date,
      targetRestaurantId: body?.targetRestaurantId,
      reason: body?.reason,
      actor: ctx,
      req,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
