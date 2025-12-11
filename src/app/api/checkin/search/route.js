// src/app/api/checkin/search/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class"; // ใช้ตัวเดียวกับฝั่ง admin ที่เก็บ classes

export const dynamic = "force-dynamic";

function toYMD(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json();
  const keyword = (body.keyword || "").trim();
  const classId = body.classId || null;

  if (!keyword) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const regex = new RegExp(keyword, "i");

  // ---------- หา class ที่ใช้ ----------
  let classFilter = {};
  let targetClassIds = [];

  if (classId) {
    classFilter.classId = classId;
    targetClassIds = [classId];
  } else {
    const todayStr = toYMD(new Date());

    const allClasses = await Class.find(
      {},
      { _id: 1, date: 1, dayCount: 1, "duration.dayCount": 1 }
    ).lean();

    const activeTodayIds = [];

    for (const c of allClasses) {
      if (!c.date) continue;

      const start = new Date(c.date);
      if (Number.isNaN(start.getTime())) continue;

      const days =
        typeof c.dayCount === "number"
          ? c.dayCount
          : typeof c.duration?.dayCount === "number"
          ? c.duration.dayCount
          : 1;

      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (toYMD(d) === todayStr) {
          activeTodayIds.push(String(c._id));
          break;
        }
      }
    }

    if (!activeTodayIds.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    targetClassIds = activeTodayIds;
    classFilter.classId = { $in: activeTodayIds };
  }

  // ---------- ดึง student ตาม classFilter + keyword ----------
  const filter = {
    ...classFilter,
    $or: [
      { thaiName: regex },
      { engName: regex },
      { email: regex },
      { company: regex },
      { paymentRef: regex },
    ],
  };

  const students = await Student.find(filter)
    .sort({ thaiName: 1 })
    .limit(30)
    .lean();

  if (!students.length) {
    return NextResponse.json({ ok: true, items: [] });
  }

  // ---------- ดึง class info แล้ว map ใส่ในแต่ละ student ----------
  const classIdsInResult = [
    ...new Set(
      students
        .map((s) => (s.classId ? String(s.classId) : null))
        .filter(Boolean)
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
    }
  ).lean();

  const classMap = new Map(classDocs.map((c) => [String(c._id), c]));

  const items = students.map((s) => {
    const classDoc = classMap.get(String(s.classId));
    if (!classDoc) {
      return { ...s, classInfo: null };
    }

    const dayCount =
      typeof classDoc.dayCount === "number"
        ? classDoc.dayCount
        : typeof classDoc.duration?.dayCount === "number"
        ? classDoc.duration.dayCount
        : 1;

    return {
      ...s,
      classInfo: {
        _id: classDoc._id,
        title: classDoc.title || classDoc.courseName || "",
        room: classDoc.room || "",
        date: classDoc.date || null,
        dayCount,
      },
    };
  });

  return NextResponse.json({ ok: true, items });
}
