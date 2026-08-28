// src/app/api/classroom/masterclass/list/route.js
//
// Masterclass classes a learner can check into right now (Asia/Bangkok today).

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import MasterclassCourse from "@/models/MasterclassCourse";
import { bangkokYMD, computeDayIndexToday } from "@/lib/classDates";
import {
  buildMasterclassCard,
  compareMasterclassCards,
  MASTERCLASS_CLASS_SELECT,
  MASTERCLASS_COURSE_SELECT,
} from "@/lib/masterclassPublic.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();

    // referenced so the MasterclassCourse model is registered before populate()
    void MasterclassCourse;

    const todayYMD = bangkokYMD(new Date());
    if (!todayYMD) return NextResponse.json({ ok: true, items: [] });

    const classes = await Class.find({ classKind: "masterclass" })
      .select(MASTERCLASS_CLASS_SELECT)
      .populate("masterclassCourseId", MASTERCLASS_COURSE_SELECT)
      .lean();

    const items = [];
    for (const cls of classes) {
      // วันนี้ต้องอยู่ในวันอบรมของคลาสนั้น (days[] เป็นตัวตัดสิน ถ้ามี)
      const dayIndexToday = computeDayIndexToday(cls, todayYMD);
      if (!dayIndexToday) continue;

      items.push(buildMasterclassCard(cls, dayIndexToday));
    }

    items.sort(compareMasterclassCards);

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/classroom/masterclass/list error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
