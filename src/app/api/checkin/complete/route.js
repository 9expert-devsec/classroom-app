// src/app/api/checkin/complete/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";

export const dynamic = "force-dynamic";

export async function POST(req) {
  await dbConnect();

  const body = await req.json();
  const { studentId, classId, day } = body || {};

  if (!studentId || !classId || !day) {
    return NextResponse.json(
      { ok: false, error: "missing studentId / classId / day" },
      { status: 400 }
    );
  }

  const student = await Student.findById(studentId).lean();
  const klass = await Class.findById(classId).lean();

  if (!student || !klass) {
    return NextResponse.json(
      { ok: false, error: "student or class not found" },
      { status: 404 }
    );
  }

  const now = new Date();

  // ---------------------------------------------------
  // ✅ โลจิก “สายหรือไม่สาย”
  //    - ใช้วัน/เวลาอบรมของคลาส (cls.date)
  //    - ถ้าเลย 09:30 (เวลาไทย) → isLate = true
  //      (ถ้าอยากผูกกับเวลาที่ตั้งใน class.duration.startTime ก็ทำต่อได้)
  // ---------------------------------------------------
  let isLate = false;

  try {
    // กำหนดวันที่อบรมจาก field date ของ Class
    const start = new Date(klass.date || now);

    // ถ้าคุณมีเวลาเริ่มใน duration.startTime (เช่น "09:00")
    // จะผูก cutoff = เวลาเริ่ม + 30 นาที
    const startTimeStr = klass.duration?.startTime || "09:00"; // fallback 09:00
    const [hStr, mStr] = startTimeStr.split(":");
    const startHour = Number(hStr) || 9;
    const startMinute = Number(mStr) || 0;

    // เซ็ตเวลาเริ่มเป็น hh:mm ของวันอบรม
    start.setHours(startHour, startMinute, 0, 0);

    // cutoff = เวลาเริ่ม + 30 นาที  → ถ้าเลยเวลานี้ = สาย
    const cutoff = new Date(start.getTime() + 30 * 60 * 1000);

    // ถ้าคุณอยาก fix 09:30 ตายตัว ไม่ตามเวลาเริ่มของคลาส
    // ให้ใช้โค้ดนี้แทน 2 บรรทัดด้านบน:
    //
    // start.setHours(9, 30, 0, 0); // 09:30 ของวันอบรม
    // const cutoff = start;

    if (now > cutoff) {
      isLate = true;
    }
  } catch (e) {
    console.error("late check error:", e);
    // ถ้าเกิด error ระหว่างคำนวณ ให้ถือว่า "ไม่สาย" เพื่อไม่ให้พัง
    isLate = false;
  }

  // ---------------------------------------------------
  // ดึงข้อมูลอาหารและ signature จาก Student ไปเก็บใน Checkin
  // ---------------------------------------------------
  const food = student.food || {};
  const signatureUrl = student.signatureUrl || "";

  // upsert Checkin record ของวันนั้น
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
    { new: true, upsert: true }
  ).lean();

  // ---------------------------------------------------
  // อัปเดตสถานะใน Student เองด้วย (ให้หน้า Class ใช้ render)
  // ---------------------------------------------------
  const checkinStatus = student.checkinStatus || {};
  checkinStatus[`day${day}`] = true;

  await Student.findByIdAndUpdate(studentId, {
    $set: {
      checkinStatus,
      isLate, // ถ้าต้องการให้ flag ว่าคนนี้เคยสาย
      lastCheckinAt: now,
      signatureUrl,
      food,
    },
  });

  return NextResponse.json({
    ok: true,
    item: checkinDoc,
    isLate,
  });
}
