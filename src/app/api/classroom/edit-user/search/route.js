// src/app/api/classroom/edit-user/search/route.js
//
// Staff search for "people already checked in today" to edit their food.
//
// L2c: the day is resolved PER CLASS on the server with classDayIndexToday
// (Asia/Bangkok, days[] first) - the client no longer sends or decides it.
// A learner matches when they have a Checkin for their class on that class's
// today-index AND isCheckinToday (same rule as the lunch-token check).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { kioskStaffGuard } from "@/lib/kioskAuth.server";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";
import { classDayIndexToday, isCheckinToday } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const LIMIT = 30;

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
  // L2b: kiosk session + staff step-up, before any DB work or body parsing
  const denied = await kioskStaffGuard(req);
  if (denied) return denied;

  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const keyword = String(body?.keyword || "").trim();
  // optional: limit to one class (still only if it runs today)
  const onlyClassId = body?.classId ? String(body.classId).trim() : "";

  if (!keyword) return NextResponse.json({ ok: true, items: [] });
  if (onlyClassId && !/^[0-9a-fA-F]{24}$/.test(onlyClassId)) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const regex = new RegExp(escapeRegExp(keyword), "i");
  const now = new Date();

  // ---------- classes running today, each with its own day index ----------
  // ✅ ไม่รวม Masterclass: ไม่มีอาหารให้แก้ไข
  const classFilter = { classKind: { $ne: "masterclass" } };
  if (onlyClassId) classFilter._id = onlyClassId;

  const classes = await Class.find(classFilter, {
    _id: 1,
    title: 1,
    courseName: 1,
    room: 1,
    date: 1,
    days: 1,
    dayCount: 1,
    "duration.dayCount": 1,
  }).lean();

  const todayClasses = new Map(); // classId -> { cls, day }
  for (const c of classes) {
    const day = classDayIndexToday(c, now);
    if (day) todayClasses.set(String(c._id), { cls: c, day });
  }

  if (!todayClasses.size) return NextResponse.json({ ok: true, items: [] });

  // ---------- check-in rows of today (per class, its own day) ----------
  const checkins = await Checkin.find(
    {
      $or: [...todayClasses.values()].map(({ cls, day }) => ({
        classId: cls._id,
        day,
      })),
    },
    { studentId: 1, classId: 1, day: 1, time: 1 },
  ).lean();

  // studentId -> classId of a check-in that really happened today
  const checkedInToday = new Map();
  for (const ck of checkins) {
    if (!isCheckinToday(ck, now)) continue;
    checkedInToday.set(String(ck.studentId), String(ck.classId));
  }

  if (!checkedInToday.size) return NextResponse.json({ ok: true, items: [] });

  const students = await Student.find({
    _id: { $in: [...checkedInToday.keys()] },
    $or: [
      { thaiName: regex },
      { engName: regex },
      { name: regex },
      { email: regex },
      { company: regex },
      { paymentRef: regex },
    ],
  })
    .sort({ thaiName: 1 })
    .limit(LIMIT)
    .lean();

  const items = [];
  for (const s of students) {
    const classId = String(s.classId || "");
    // the check-in must belong to the class the learner is registered in
    if (checkedInToday.get(String(s._id)) !== classId) continue;

    const entry = todayClasses.get(classId);
    if (!entry) continue;
    const { cls, day } = entry;

    items.push({
      _id: s._id,
      thaiName: s.thaiName || "",
      engName: s.engName || "",
      name: s.name || "",
      company: s.company || "",
      paymentRef: s.paymentRef || "",
      classId: s.classId,
      food: s.food || {},
      // today's training day of THIS learner's class (server-resolved)
      day,
      classInfo: {
        _id: cls._id,
        title: cls.title || cls.courseName || "",
        room: cls.room || "",
        date: cls.date || null,
      },
    });
  }

  return NextResponse.json({ ok: true, items });
}
