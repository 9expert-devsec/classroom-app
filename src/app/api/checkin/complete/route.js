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

// เพิ่มวันให้ YYYY-MM-DD (คง timezone +07:00)
function addDaysYMD(ymd, addDays) {
  const base = new Date(`${ymd}T00:00:00+07:00`);
  base.setDate(base.getDate() + (Number(addDays) || 0));
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
}

// หา “วันที่อบรมของ day นั้น”
// - ถ้ามี klass.days[] ใช้เป็น source of truth
// - ไม่งั้น fallback จาก klass.date + (day-1)
function resolveTrainingYMD(klass, day) {
  const d = Math.max(1, Number(day || 1));

  if (Array.isArray(klass?.days) && klass.days[d - 1]) {
    // เก็บเป็น YYYY-MM-DD อยู่แล้วก็ได้ หรือเป็น date string ก็ slice ได้
    return String(klass.days[d - 1]).slice(0, 10);
  }

  const startYMD = toYMD_BKK(klass?.date || new Date());
  return addDaysYMD(startYMD, d - 1);
}

// สร้าง cutoff เวลา 09:00 ของวันนั้น (เวลาไทย)
function buildCutoff0900BKK(ymd) {
  // 09:00:00 เวลาไทยของวันนั้น
  return new Date(`${ymd}T09:00:00+07:00`);
}

/* ---------------- route ---------------- */

export async function POST(req) {
  await dbConnect();

  const body = await req.json();
  const { studentId, classId, day } = body || {};

  if (!studentId || !classId || !day) {
    return NextResponse.json(
      { ok: false, error: "missing studentId / classId / day" },
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

  const now = new Date();

  // ---------------------------------------------------
  // ✅ โลจิก “สายหรือไม่สาย” (รายวัน)
  // - ของทุกๆวันนับใหม่
  // - ถ้าเวลาไทย <= 09:00 ไม่สาย
  // - ถ้าเวลาไทย > 09:00 สาย
  // ---------------------------------------------------
  let isLate = false;
  let lateMeta = null;

  try {
    const ymd = resolveTrainingYMD(klass, day);
    const cutoff = buildCutoff0900BKK(ymd);

    // now เป็นเวลาปัจจุบัน (UTC ภายใน) แต่เทียบกับ cutoff ที่ fix +07 ได้ตรง
    isLate = now > cutoff;

    lateMeta = {
      trainingYMD: ymd,
      cutoffISO: cutoff.toISOString(),
      nowISO: now.toISOString(),
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
      day: Number(day),
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
  checkinStatus[`day${day}`] = true;

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
    isLate,
    lateMeta, // debug ได้ (จะเอาออกทีหลังก็ได้)
  });
}
