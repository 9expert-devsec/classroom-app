// src/app/api/checkin/complete/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";

export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

// แปลง dateInput ให้เป็น YYYY-MM-DD ตามเวลาไทย (Asia/Bangkok)
function toYMD_BKK(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const bkk = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${bkk.getFullYear()}-${pad2(bkk.getMonth() + 1)}-${pad2(bkk.getDate())}`;
}

// YYYY-MM-DD ของ “วันนี้” เวลาไทย
function todayYMD_BKK() {
  // ใช้ en-CA ได้รูปแบบ YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// เพิ่มวันให้ YYYY-MM-DD (คง timezone +07:00)
function addDaysYMD(ymd, addDays) {
  const base = new Date(`${ymd}T00:00:00+07:00`);
  base.setDate(base.getDate() + (Number(addDays) || 0));
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
}

function getDayCount(klass) {
  if (Array.isArray(klass?.days) && klass.days.length > 0)
    return klass.days.length;
  const n = Number(klass?.dayCount || 0);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// list วันอบรมทั้งหมดของคลาสเป็น YYYY-MM-DD
function buildTrainingDaysYMD(klass) {
  if (Array.isArray(klass?.days) && klass.days.length > 0) {
    return klass.days.map((x) => String(x).slice(0, 10));
  }
  const startYMD = toYMD_BKK(klass?.date || new Date());
  const n = getDayCount(klass);
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDaysYMD(startYMD, i));
  return out;
}

// หา “วันที่อบรมของ day นั้น”
// - ถ้ามี klass.days[] ใช้เป็น source of truth
// - ไม่งั้น fallback จาก klass.date + (day-1)
function resolveTrainingYMD(klass, day) {
  const d = Math.max(1, Number(day || 1));

  if (Array.isArray(klass?.days) && klass.days[d - 1]) {
    return String(klass.days[d - 1]).slice(0, 10);
  }

  const startYMD = toYMD_BKK(klass?.date || new Date());
  return addDaysYMD(startYMD, d - 1);
}

// สร้าง cutoff เวลา 09:00 ของวันนั้น (เวลาไทย)
function buildCutoff0900BKK(ymd) {
  return new Date(`${ymd}T09:00:00+07:00`);
}

/* ---------------- route ---------------- */

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const { studentId, classId, day } = body || {};

  // ✅ day ไม่บังคับแล้ว (ให้ server ตัดสินเอง)
  if (!studentId || !classId) {
    return NextResponse.json(
      { ok: false, error: "missing studentId / classId" },
      { status: 400 },
    );
  }

  const student = await Student.findById(studentId).lean();
  const klass = await Class.findById(classId).lean();

  if (!student || !klass) {
    return NextResponse.json(
      { ok: false, error: "student or class not found" },
      { status: 404 },
    );
  }

  // ---------------------------------------------------
  // ✅ FIX: ตัดสิน day จาก “วันนี้ (BKK)” เทียบกับวันอบรมของคลาส
  // - ถ้าวันนี้อยู่ใน klass.days[]/computed days -> override day ให้ถูก
  // - ถ้าวันนี้ไม่ใช่วันอบรม -> fallback ใช้ day ที่ส่งมา หรือ 1
  // ---------------------------------------------------
  const todayYMD = todayYMD_BKK();
  const dayList = buildTrainingDaysYMD(klass);
  const idxToday = dayList.findIndex((x) => x === todayYMD);
  const computedDay = idxToday >= 0 ? idxToday + 1 : null;

  const fallbackDay = Math.max(1, Number(day || 1));
  const effectiveDay = computedDay || fallbackDay;

  const now = new Date();
 
  // ---------------------------------------------------
  // ✅ โลจิก “สายหรือไม่สาย” (รายวัน)
  // ---------------------------------------------------
  let isLate = false;
  let lateMeta = null;

  try {
    const ymd = resolveTrainingYMD(klass, effectiveDay);
    const cutoff = buildCutoff0900BKK(ymd);
    isLate = now > cutoff;

    lateMeta = {
      trainingYMD: ymd,
      cutoffISO: cutoff.toISOString(),
      nowISO: now.toISOString(),
      effectiveDay,
      todayYMD,
      dayList,
      inputDay: day ?? null,
    };
  } catch (e) {
    console.error("late check error:", e);
    isLate = false;
  }

  // ---------------------------------------------------
  // ดึงข้อมูลอาหารและ signature จาก Student ไปเก็บใน Checkin
  // ---------------------------------------------------
  const food = student.food || {};
  const signatureUrl = student.signatureUrl || "";

  // upsert Checkin record ของวันนั้น (รายวัน)
  const checkinDoc = await Checkin.findOneAndUpdate(
    {
      studentId: student._id,
      classId: klass._id,
      day: Number(effectiveDay),
    },
    {
      time: now,
      isLate,
      food,
      signatureUrl,
    },
    { new: true, upsert: true },
  ).lean();

  // ---------------------------------------------------
  // อัปเดตสถานะใน Student (รายวันผ่าน checkinStatus)
  // ---------------------------------------------------
  const checkinStatus = student.checkinStatus || {};
  checkinStatus[`day${effectiveDay}`] = true;

  await Student.findByIdAndUpdate(studentId, {
    $set: {
      checkinStatus,
      lastCheckinAt: now,
      signatureUrl,
      food,
    },
  });

  return NextResponse.json({
    ok: true,
    item: checkinDoc,
    effectiveDay,
    isLate,
    lateMeta, // debug ได้ (ค่อยเอาออกทีหลังก็ได้)
  });
}
