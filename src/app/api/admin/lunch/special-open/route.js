// src/app/api/admin/lunch/special-open/route.js
// POST { orderId } -> { orderId, path, deadlineAt, reopenCount, holderName }
// เปิดเวลาพิเศษ (token เดิม) ให้ออเดอร์ pending/unassigned ของวันนี้
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { specialOpenLunchOrder, lunchAdminErrorBody } from "@/lib/lunchAdmin.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await specialOpenLunchOrder({
      orderId: body?.orderId,
      adminId: ctx.userId,
      ctx,
      req,
    });
    return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
