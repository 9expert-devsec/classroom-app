// src/app/api/admin/lunch/issue/route.js
// POST { classId, studentId } -> { ok, orderId, deadlineAt, path, qrUrl }
// R2a (R-g): ออก QR ให้ผู้เรียนที่เลือกคูปองแต่ยังไม่มีใบ live — กติกาเดียวกับแท็บเล็ต
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { issueLunchQrForCoupon } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await issueLunchQrForCoupon({
      classId: String(body?.classId || ""),
      studentId: String(body?.studentId || ""),
      ctx,
      req,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
