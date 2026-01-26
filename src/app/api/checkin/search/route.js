// src/app/api/checkin/search/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";

export const dynamic = "force-dynamic";

const TZ_OFFSET = "+07:00"; // Bangkok

function safeNum(x, fallback = 1) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// YYYY-MM-DD ตามเวลาไทย
function toYMD_BKK(dateInput) {
  const d = new Date(dateInput);
  if (!isValidDate(d)) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function addDaysYMD_BKK(ymd, addDays) {
  if (!ymd) return "";
  const base = new Date(`${ymd}T00:00:00${TZ_OFFSET}`);
  if (!isValidDate(base)) return "";
  base.setDate(base.getDate() + Number(addDays || 0));
  return toYMD_BKK(base);
}

function getDayCountFromClassDoc(c) {
  return typeof c?.dayCount === "number"
    ? c.dayCount
    : typeof c?.duration?.dayCount === "number"
      ? c.duration.dayCount
      : 1;
}

export async function POST(req) {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const keyword = String(body?.keyword || "").trim();
  const classId = body?.classId ? String(body.classId) : "";
  const day = safeNum(body?.day, 1);

  if (!keyword) return NextResponse.json({ ok: true, items: [] });

  const regex = new RegExp(keyword, "i");

  const todayYMD = toYMD_BKK(new Date());
  if (!todayYMD) return NextResponse.json({ ok: true, items: [] });

  // -----------------------------
  // หา class ที่จะค้นหา
  // - ถ้าส่ง classId มา: ใช้คลาสนั้น
  // - ถ้าไม่ส่ง: เอาเฉพาะคลาสที่ "วันนี้" ตรงกับ day ที่เลือก
  // -----------------------------
  let targetClassIds = [];

  if (classId) {
    const c = await Class.findById(classId, {
      _id: 1,
      date: 1,
      dayCount: 1,
      "duration.dayCount": 1,
    }).lean();

    if (!c) return NextResponse.json({ ok: true, items: [] });

    const dayCount = getDayCountFromClassDoc(c);
    if (day > dayCount) return NextResponse.json({ ok: true, items: [] });

    // (ถ้าอยากบังคับว่าต้องตรง “วันนี้” ด้วยค่อยเปิด)
    // const startYMD = toYMD_BKK(c.date);
    // const expectedYMD = addDaysYMD_BKK(startYMD, day - 1);
    // if (expectedYMD !== todayYMD) return NextResponse.json({ ok: true, items: [] });

    targetClassIds = [String(c._id)];
  } else {
    const all = await Class.find(
      {},
      { _id: 1, date: 1, dayCount: 1, "duration.dayCount": 1 },
    ).lean();

    const activeIds = [];

    for (const c of all) {
      if (!c?.date) continue;

      const dayCount = getDayCountFromClassDoc(c);
      if (day > dayCount) continue;

      const startYMD = toYMD_BKK(c.date);
      if (!startYMD) continue;

      // วันนี้ต้องตรงกับ “วันอบรมของ day ที่เลือก”
      const expectedYMD = addDaysYMD_BKK(startYMD, day - 1);
      if (expectedYMD === todayYMD) activeIds.push(String(c._id));
    }

    if (!activeIds.length) return NextResponse.json({ ok: true, items: [] });
    targetClassIds = activeIds;
  }

  // -----------------------------
  // ✅ ตัดคนที่เช็คอิน day นี้แล้ว (ใช้ Checkin จริง)
  // -----------------------------
  const checked = await Checkin.find(
    { classId: { $in: targetClassIds }, day: Number(day) },
    { studentId: 1 },
  ).lean();

  const checkedStudentIds = checked.map((x) => x.studentId).filter(Boolean);

  // -----------------------------
  // query students
  // -----------------------------
  const filter = {
    classId: { $in: targetClassIds },
    ...(checkedStudentIds.length ? { _id: { $nin: checkedStudentIds } } : {}),
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
  if (!students.length) return NextResponse.json({ ok: true, items: [] });

  // -----------------------------
  // attach class info
  // -----------------------------
  const classIdsInResult = [
    ...new Set(
      students.map((s) => (s.classId ? String(s.classId) : "")).filter(Boolean),
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
    if (!c) return { ...s, classInfo: null };

    const dayCount = getDayCountFromClassDoc(c);

    return {
      ...s,
      classInfo: {
        _id: c._id,
        title: c.title || c.courseName || "",
        courseName: c.courseName || c.title || "",
        room: c.room || "",
        date: c.date || null,
        dayCount,
      },
    };
  });

  return NextResponse.json({ ok: true, items });
}
