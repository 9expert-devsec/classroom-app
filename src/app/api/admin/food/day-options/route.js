// src/app/api/admin/food/day-options/route.js
// R4-5A: ตัวเลือกอาหารของคลาส/วันตามแผน Food Calendar สำหรับโมดัลแก้ไขอาหาร (Food Report)
//        มาจาก getFoodDayOptions ตัวเดียวกับ kiosk (/api/food/today) และการตรวจตอนบันทึก
//        ไม่ดูเวลา 15:00 (แอดมินไม่ติดเวลาปิดคูปอง) — คูปองขึ้นกับแผนของวัน + disableCoupon ของคลาสเท่านั้น
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import {
  getFoodDayOptions,
  toModalOptions,
} from "@/lib/foodDayOptions.server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unauthorized" },
      { status: e?.status || 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const classId = String(searchParams.get("classId") || "").trim();
  const day = Number(searchParams.get("day"));

  if (!/^[0-9a-fA-F]{24}$/.test(classId)) {
    return NextResponse.json(
      { ok: false, error: "classId is required" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json(
      { ok: false, error: "day is required" },
      { status: 400 },
    );
  }

  try {
    await dbConnect();
    const opts = await getFoodDayOptions({ classId, day });
    if (!opts.classDoc) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบคลาส" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      dayYMD: opts.dayYMD,
      ...toModalOptions(opts),
    });
  } catch (err) {
    console.error("GET /api/admin/food/day-options error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
