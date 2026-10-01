// src/app/api/admin/lunch/special-open/route.js
// POST -> 410 { error, reason: "gone" }
//
// C1: ถอดออกแล้ว — "เปิดเวลาพิเศษ" (token เดิม) ของใบ pending ไม่มีอีกต่อไป
//     ใบ pending สั่งแบบย่อเองได้ถึง 15:00 ส่วนคนที่สั่งแล้วอยากเปลี่ยนใช้ ยกเลิก + ออก QR ใหม่
//     เก็บไฟล์ไว้ให้ client เก่าที่ยังยิงมาได้คำตอบชัดเจน แทนที่จะเป็น 404
import { NextResponse } from "next/server";
import { finalCloseLabel } from "@/lib/lunchConfig";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  return NextResponse.json(
    {
      error: `ยกเลิกฟังก์ชันเปิดเวลาพิเศษแล้ว ผู้เรียนสั่งแบบย่อได้เองถึง ${finalCloseLabel()} น.`,
      reason: "gone",
    },
    { status: 410, headers: NO_STORE },
  );
}

/* ---- ของเดิม (ก่อน C1) ----
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { specialOpenLunchOrder, lunchAdminErrorBody } from "@/lib/lunchAdmin.server";

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
---- */
