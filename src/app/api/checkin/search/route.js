// src/app/api/checkin/search/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";
import {
  bangkokYMD as toYMD_BKK,
  computeDayIndexToday,
  getDayCountFromClassDoc,
} from "@/lib/classDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNum(x, fallback = 1) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clean(s) {
  return String(s || "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const keyword = clean(body?.keyword);
  const classId = body?.classId ? String(body.classId) : "";
  // day ที่ client ส่งมาเอง (Masterclass ส่ง) — ไม่ส่ง = null ให้ใช้ "วันนี้" ของคลาส
  const dayFromClient =
    body?.day === undefined || body?.day === null || body?.day === ""
      ? null
      : safeNum(body.day, 1);

  if (!keyword) return NextResponse.json({ ok: true, items: [] });

  const todayYMD = toYMD_BKK(new Date());
  if (!todayYMD) return NextResponse.json({ ok: true, items: [] });

  const regex = new RegExp(escapeRegExp(keyword), "i");

  // -----------------------------
  // หา class ที่จะค้นหา + dayIndex ของ "วันนี้" ต่อคลาส
  // -----------------------------
  let targetClassIds = [];
  const dayByClassId = new Map(); // classId -> dayIndex

  if (classId) {
    const c = await Class.findById(classId, {
      _id: 1,
      date: 1,
      days: 1,
      dayCount: 1,
      "duration.dayCount": 1,
    }).lean();

    if (!c) return NextResponse.json({ ok: true, items: [] });

    const dayCount = getDayCountFromClassDoc(c);

    // ✅ compat: ถ้าฝั่ง UI ส่ง day มา (เช่น admin เลือก day เอง) ให้ใช้ day นั้นได้
    // แต่ถ้าไม่ได้ส่งจริง ๆ (หรือส่งมั่ว) → fallback ไปใช้ day ของวันนี้ที่คำนวณได้
    // P3g: เดิมไม่ส่ง = Day 1 เสมอ ทำให้ตัดคนที่เช็คอินผิดวัน — ตอนนี้ไม่ส่ง = วันนี้
    //      (วันนี้ไม่ใช่วันเรียน -> คง Day 1 ไว้แบบเดิม)
    let useDay = dayFromClient ?? computeDayIndexToday(c, todayYMD) ?? 1;

    if (useDay > dayCount) {
      // fallback หา dayToday
      const d = computeDayIndexToday(c, todayYMD);
      if (!d) return NextResponse.json({ ok: true, items: [] });
      useDay = d;
    }

    // ถ้าต้องการ “บังคับว่าต้องตรงวันนี้เท่านั้น” เปิดเงื่อนไขนี้:
    // const d2 = computeDayIndexToday(c, todayYMD);
    // if (!d2) return NextResponse.json({ ok: true, items: [] });

    targetClassIds = [String(c._id)];
    dayByClassId.set(String(c._id), useDay);
  } else {
    // ไม่มี classId → เอาคลาสที่วันนี้อยู่ในช่วงอบรมทั้งหมด
    // ✅ ยกเว้น Masterclass: มีทางเข้าของตัวเองที่ /classroom/masterclass
    //    และไม่มีขั้นตอนอาหาร ถ้าโผล่ในผลค้นหานี้ผู้เรียนจะถูกพาไปหน้าอาหาร
    const all = await Class.find(
      { classKind: { $ne: "masterclass" } },
      { _id: 1, date: 1, days: 1, dayCount: 1, "duration.dayCount": 1 },
    ).lean();

    const activeIds = [];

    for (const c of all) {
      const d = computeDayIndexToday(c, todayYMD);
      if (!d) continue;

      const cid = String(c._id);
      activeIds.push(cid);
      dayByClassId.set(cid, d);
    }

    if (!activeIds.length) return NextResponse.json({ ok: true, items: [] });
    targetClassIds = activeIds;
  }

  // -----------------------------
  // ✅ ตัดคนที่เช็คอินแล้ว "ของวันนั้น" (ต่อคลาส)
  // -----------------------------
  const orConds = targetClassIds.map((cid) => ({
    classId: cid,
    day: Number(dayByClassId.get(cid) || 1),
  }));

  const checked = await Checkin.find({ $or: orConds }, { studentId: 1 }).lean();

  const checkedStudentIds = checked.map((x) => x.studentId).filter(Boolean);

  // -----------------------------
  // query students
  // -----------------------------
  const filter = {
    classId: { $in: targetClassIds },
    ...(checkedStudentIds.length ? { _id: { $nin: checkedStudentIds } } : {}),
    $or: [
      // ฟิลด์เดิม
      { thaiName: regex },
      { engName: regex },

      // ✅ เพิ่มให้ครอบคลุม (แล้วแต่ schema มี/ไม่มีไม่เป็นไร)
      { fullName: regex },
      { name: regex },
      { firstName: regex },
      { lastName: regex },
      { thaiFirstName: regex },
      { thaiLastName: regex },

      // ช่องทางค้นหาที่ใช้จริงบ่อย
      { phone: regex },
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
      days: 1,
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
        // P3g: วันเรียนของ "วันนี้" ตัดสินที่ server (เวลาไทย, days[] ก่อน)
        // แท็บเล็ตใช้ค่านี้ตรง ๆ ไม่คำนวณจากนาฬิกาเครื่องเองอีก — null = วันนี้ไม่ใช่วันเรียน
        todayDay: computeDayIndexToday(c, todayYMD),
      },
    };
  });

  return NextResponse.json({ ok: true, items });
}
