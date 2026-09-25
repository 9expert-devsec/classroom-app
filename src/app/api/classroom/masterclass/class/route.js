// src/app/api/classroom/masterclass/class/route.js
//
// One Masterclass class, for the learner check-in screens.
// Masterclass only: a normal class must never be readable through this route.

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { kioskGuard } from "@/lib/kioskAuth.server";
import Class from "@/models/Class";
import MasterclassCourse from "@/models/MasterclassCourse";
import { bangkokYMD, computeDayIndexToday } from "@/lib/classDates";
import {
  buildMasterclassCard,
  MASTERCLASS_CLASS_SELECT,
  MASTERCLASS_COURSE_SELECT,
} from "@/lib/masterclassPublic.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObjectId(x) {
  return /^[0-9a-fA-F]{24}$/.test(String(x || "").trim());
}

function notFound() {
  return NextResponse.json(
    { ok: false, error: "class_not_found" },
    { status: 404 },
  );
}

export async function GET(req) {
  // L2a: kiosk session required, before any DB work or body parsing
  const denied = await kioskGuard(req);
  if (denied) return denied;

  try {
    await dbConnect();

    // referenced so the MasterclassCourse model is registered before populate()
    void MasterclassCourse;

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || searchParams.get("classid");

    if (!isObjectId(classId)) return notFound();

    const cls = await Class.findById(classId)
      .select(MASTERCLASS_CLASS_SELECT)
      .populate("masterclassCourseId", MASTERCLASS_COURSE_SELECT)
      .lean();

    // ✅ ไม่ใช่ Masterclass = ไม่ให้อ่านผ่าน endpoint นี้
    if (!cls || cls.classKind !== "masterclass") return notFound();

    const todayYMD = bangkokYMD(new Date());
    const dayIndexToday = todayYMD ? computeDayIndexToday(cls, todayYMD) : null;

    return NextResponse.json({
      ok: true,
      item: buildMasterclassCard(cls, dayIndexToday),
    });
  } catch (err) {
    console.error("GET /api/classroom/masterclass/class error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
