// src/app/api/checkin/search/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ_OFFSET = "+07:00"; // Bangkok

function safeNum(x, fallback = 1) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function clean(s) {
  return String(s || "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// base YMD + addDays → YMD (BKK)
function addDaysYMD_BKK(ymd, addDays) {
  if (!ymd) return "";
  const base = new Date(`${ymd}T00:00:00${TZ_OFFSET}`);
  if (!isValidDate(base)) return "";
  base.setDate(base.getDate() + Number(addDays || 0));
  return toYMD_BKK(base);
}

// diff days (end - start) in Bangkok date space
function diffDaysYMD_BKK(startYMD, endYMD) {
  const a = new Date(`${startYMD}T00:00:00${TZ_OFFSET}`);
  const b = new Date(`${endYMD}T00:00:00${TZ_OFFSET}`);
  if (!isValidDate(a) || !isValidDate(b)) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

function getDayCountFromClassDoc(c) {
  return typeof c?.dayCount === "number"
    ? c.dayCount
    : typeof c?.duration?.dayCount === "number"
      ? c.duration.dayCount
      : 1;
}

// หา dayIndex ของ "วันนี้" สำหรับคลาสนั้น
// 1) ถ้ามี days[] (YYYY-MM-DD) ใช้อันนี้แม่นสุด
// 2) fallback ใช้ date + dayCount คำนวณช่วง
function computeDayIndexToday(c, todayYMD) {
  if (!c) return null;

  // ✅ ถ้ามี days[] เช่น ["2026-01-26","2026-01-27",...]
  if (Array.isArray(c.days) && c.days.length) {
    const idx = c.days.findIndex((d) => String(d || "") === todayYMD);
    if (idx >= 0) return idx + 1; // 1-based
    return null;
  }

  // fallback แบบ date + dayCount
  if (!c.date) return null;
  const dayCount = getDayCountFromClassDoc(c);
  const startYMD = toYMD_BKK(c.date);
  if (!startYMD) return null;

  const endYMD = addDaysYMD_BKK(startYMD, dayCount - 1);
  if (!endYMD) return null;

  // วันนี้ต้องอยู่ในช่วงวันอบรม
  if (!(todayYMD >= startYMD && todayYMD <= endYMD)) return null;

  const dayToday = diffDaysYMD_BKK(startYMD, todayYMD) + 1;
  return Math.min(Math.max(dayToday, 1), dayCount);
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
  const dayFromClient = safeNum(body?.day, 1);

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
    let useDay = dayFromClient;

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
    const all = await Class.find(
      {},
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
      },
    };
  });

  return NextResponse.json({ ok: true, items });
}
