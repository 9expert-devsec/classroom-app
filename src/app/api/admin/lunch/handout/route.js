// src/app/api/admin/lunch/handout/route.js
// POST { orderId } -> { orderId, code, handedOutAt, handedOutBy }
// Counter ส่งมอบคูปองกระดาษ (stock) ให้ผู้เรียน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import {
  handOutLunchCoupon,
  adminDisplayName,
  lunchAdminErrorBody,
} from "@/lib/lunchAdmin.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await handOutLunchCoupon({
      orderId: body?.orderId,
      adminId: ctx.userId,
      adminName: adminDisplayName(ctx),
      ctx,
      req,
    });
    return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
