// src/app/api/classroom/edit-user/search/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

function ymdInBKK(date = new Date()) {
  // ได้ "YYYY-MM-DD" ตามเวลาไทย
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const keyword = String(body?.keyword || "").trim();
  const classId = body?.classId ? String(body.classId) : "";
  const day = Number(body?.day || 1);

  if (!keyword) return NextResponse.json({ ok: true, items: [] });

  const regex = new RegExp(escapeRegExp(keyword), "i");
  const todayStr = ymdInBKK(new Date());

  // ---------- หา class ที่ active วันนี้ ----------
  let targetClassIds = [];

  if (classId) {
    targetClassIds = [classId];
  } else {
    const allClasses = await Class.find(
      {},
      { _id: 1, date: 1, dayCount: 1, "duration.dayCount": 1 },
    ).lean();

    const activeTodayIds = [];

    for (const c of allClasses) {
      if (!c?.date) continue;
      const start = new Date(c.date);
      if (Number.isNaN(start.getTime())) continue;

      const days =
        typeof c.dayCount === "number"
          ? c.dayCount
          : typeof c.duration?.dayCount === "number"
            ? c.duration.dayCount
            : 1;

      for (let i = 0; i < days; i += 1) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (ymdInBKK(d) === todayStr) {
          activeTodayIds.push(String(c._id));
          break;
        }
      }
    }

    if (!activeTodayIds.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    targetClassIds = activeTodayIds;
  }

  // ---------- filter: เฉพาะผู้ที่ checkin แล้วใน day ที่เลือก ----------
  const dayKey = `checkinStatus.day${day}`;

  const filter = {
    classId: { $in: targetClassIds },
    [dayKey]: true,
    $or: [
      { thaiName: regex },
      { engName: regex },
      { name: regex },
      { email: regex },
      { company: regex },
      { paymentRef: regex },
    ],
  };

  const students = await Student.find(filter)
    .sort({ thaiName: 1 })
    .limit(30)
    .lean();

  if (!students.length) return NextResponse.json({ ok: true, items: [] });

  // ---------- map classInfo ----------
  const classIdsInResult = [
    ...new Set(
      students
        .map((s) => (s.classId ? String(s.classId) : null))
        .filter(Boolean),
    ),
  ];

  const classDocs = await Class.find(
    { _id: { $in: classIdsInResult } },
    {
      title: 1,
      courseName: 1,
      room: 1,
      date: 1,
      dayCount: 1,
      "duration.dayCount": 1,
    },
  ).lean();

  const classMap = new Map(classDocs.map((c) => [String(c._id), c]));

  const items = students.map((s) => {
    const c = classMap.get(String(s.classId));
    const dc =
      typeof c?.dayCount === "number"
        ? c.dayCount
        : typeof c?.duration?.dayCount === "number"
          ? c.duration.dayCount
          : 1;

    return {
      _id: s._id,
      thaiName: s.thaiName || "",
      engName: s.engName || "",
      name: s.name || "",
      company: s.company || "",
      paymentRef: s.paymentRef || "",
      classId: s.classId,
      food: s.food || {},
      classInfo: c
        ? {
            _id: c._id,
            title: c.title || c.courseName || "",
            room: c.room || "",
            date: c.date || null,
            dayCount: dc,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, items });
}
