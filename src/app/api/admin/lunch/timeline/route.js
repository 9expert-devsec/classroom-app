// src/app/api/admin/lunch/timeline/route.js
// GET ?classId=&studentId=&dayYMD= -> { events: [{ at, hm, kind, label, actorName, detail, orderId, … }] }
// R2a-2: ประวัติของผู้เรียน 1 คน / 1 คลาส / 1 วัน (drawer หน้า "ติดตามการสั่งอาหาร")
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { buildLunchTimeline } from "@/lib/lunchTimeline.server";
import { isYMD } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const classId = String(searchParams.get("classId") || "").trim();
    const studentId = String(searchParams.get("studentId") || "").trim();
    const dayYMD = String(searchParams.get("dayYMD") || "").trim();

    if (
      !mongoose.Types.ObjectId.isValid(classId) ||
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !isYMD(dayYMD)
    ) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ", reason: "bad_request" },
        { status: 400, headers: NO_STORE },
      );
    }

    const res = await buildLunchTimeline({ classId, studentId, dayYMD });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
