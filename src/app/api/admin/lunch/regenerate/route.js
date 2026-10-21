// src/app/api/admin/lunch/regenerate/route.js
// POST { orderId } -> { ok, orderId, newOrderId, deadlineAt, path, qrUrl }
// R2a (R-d): ใบ pending — ยกเลิกใบเดิม (qr_regenerated) + ออกใบใหม่ เส้นตายเดิม (ไม่ยืด)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { regenerateLunchQr } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await regenerateLunchQr({
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
