// src/app/api/admin/lunch/reassign/preview/route.js
// POST { learners: [{ studentId, classId }], date, targetRestaurantId? }
//   -> { ok, dayYMD, window, shops, learners: [{ eligible, reason, message, ... }], eligibleCount, target }
// R3: อ่านอย่างเดียว — สิทธิ์ของแต่ละคน + ร้านของวันนั้น + ความจุร้านปลายทาง (ใช้ก่อนยืนยัน)
//     การโยกจริงตรวจซ้ำทั้งหมดอีกครั้งเสมอ
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { previewLunchReassign } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    // ดูอย่างเดียวแต่เป็นขั้นแรกของการโยก — สิทธิ์เดียวกับการโยกจริง
    await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await previewLunchReassign({
      learners: body?.learners,
      date: body?.date,
      targetRestaurantId: body?.targetRestaurantId,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
