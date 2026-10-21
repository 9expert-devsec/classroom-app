// src/app/api/admin/lunch/qr/route.js
// POST { orderId } -> { ok, orderId, status, deadlineAt, path, qrUrl }
// R2a (R-h): ดู QR ของใบที่ยังใช้งานได้ — POST เพื่อเขียน audit lunch.view_qr ทุกครั้ง
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { getLunchQr } from "@/lib/lunchActions.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const res = await getLunchQr({
      orderId: body?.orderId,
      ctx,
      req,
    });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
