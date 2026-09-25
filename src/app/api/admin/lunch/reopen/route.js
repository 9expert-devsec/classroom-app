// src/app/api/admin/lunch/reopen/route.js
// POST { classId, studentId, dayYMD } -> { orderId, path, deadlineAt, reopenCount, holderName }
// ออก QR ใหม่ (token ใหม่) หลังยกเลิก — เฉพาะวันนี้
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { reopenLunchOrder, lunchAdminErrorBody } from "@/lib/lunchAdmin.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await reopenLunchOrder({
      classId: body?.classId,
      studentId: body?.studentId,
      dayYMD: String(body?.dayYMD || ""),
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
