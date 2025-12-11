// src/app/api/admin/classes/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // ----------------------------- //
  // กรณีขอรายละเอียด Class เดียว
  // ----------------------------- //
  if (id) {
    const cls = await Class.findById(id).lean();
    if (!cls) {
      return NextResponse.json(
        { ok: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // จำนวนวันอบรม (ใช้กำหนดจำนวนคอลัมน์ DAY 1..n)
    const dayCount = cls.duration?.dayCount || cls.dayCount || 1;

    // ดึงรายชื่อนักเรียนจาก Student collection
    const students = await Student.find({ classId: id }).lean();

    // ดึงเช็คอินทั้งหมดของ class นี้
    const checkins = await Checkin.find({ classId: id }).lean();

    // map: studentId -> { [dayNumber]: { isLate, time, signatureUrl } }
    const checkinMap = new Map();
    for (const ch of checkins) {
      const sid = String(ch.studentId);
      const dayNum = Number(ch.day) || 1;
      if (!checkinMap.has(sid)) checkinMap.set(sid, {});
      checkinMap.get(sid)[dayNum] = {
        isLate: !!ch.isLate,
        time: ch.time || ch.createdAt || null,
        signatureUrl: ch.signatureUrl || null,
      };
    }

    // แปลง student เป็นรูปแบบที่หน้า admin ใช้
    const mergedStudents = students.map((stu) => {
      const sid = String(stu._id);
      const byDay = checkinMap.get(sid) || {};

      // checkinsByDay เก็บข้อมูลดิบสำหรับ popup ลายเซ็น
      const checkinsByDay = {};
      // checkin = flag true/false ต่อวัน, checkinTimes = เวลาเช็กอินต่อวัน
      const checkinFlags = {};
      const checkinTimes = {};

      let lastDay = null;
      let lastIsLate = false;

      for (let d = 1; d <= dayCount; d += 1) {
        const info = byDay[d];
        if (info) {
          checkinsByDay[d] = info;
          checkinFlags[`day${d}`] = true;
          checkinTimes[`day${d}`] = info.time || null;
          lastDay = d;
          lastIsLate = info.isLate;
        } else {
          checkinFlags[`day${d}`] = false;
          checkinTimes[`day${d}`] = null;
        }
      }

      let statusLabel = "-";
      if (lastDay != null) {
        statusLabel = lastIsLate
          ? `Late (Day ${lastDay})`
          : `Pass (Day ${lastDay})`;
      }

      return {
        _id: stu._id,
        // ชื่อ / บริษัท / ข้อมูลใบเสร็จ
        nameTH: stu.thaiName || stu.nameTH || "",
        nameEN: stu.engName || stu.nameEN || "",
        company: stu.company || "",
        paymentRef: stu.paymentRef || "",
        receiveType: stu.documentReceiveType || stu.receiveType || "",
        receiveDate: stu.documentReceivedAt || stu.receiveDate || null,

        // ✅ ใช้ในตาราง:
        // checkin[day1/day2/...] = true/false
        checkin: checkinFlags,
        // checkinTimes[day1/day2/...] = เวลาเช็กอิน (Date) หรือ null
        checkinTimes,
        // ใช้สรุปสถานะแถวนี้
        late: lastIsLate,
        statusLabel,

        // ✅ ข้อมูลดิบเดิม ใช้สำหรับ popup ลายเซ็น (signatureUrl, isLate, time)
        checkins: checkinsByDay,
      };
    });

    return NextResponse.json({
      ok: true,
      item: {
        ...cls,
        dayCount,
        students: mergedStudents,
      },
    });
  }

  // ----------------------------- //
  // กรณี list class ทั้งหมด (หน้า /admin/classroom/classes)
  // เพิ่ม studentsCount ให้ด้วย
  // ----------------------------- //
  const classes = await Class.find().sort({ date: -1 }).lean();
  const classIds = classes.map((c) => c._id);

  // รวมจำนวน student ต่อ class ด้วย aggregate
  const counts = await Student.aggregate([
    { $match: { classId: { $in: classIds } } },
    { $group: { _id: "$classId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    counts.map((c) => [String(c._id), c.count])
  );

  const items = classes.map((c) => ({
    ...c,
    studentsCount: countMap.get(String(c._id)) || 0,
  }));

  return NextResponse.json({ ok: true, items });
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json();

  const {
    publicCourseId,   // id ของ public-course (ถ้าส่งมา)
    courseCode,
    courseName,
    title,
    date,             // string จาก form เช่น "2025-12-09"
    dayCount,
    startTime,        // "09:00 AM" หรือ "09:00"
    endTime,          // "04:00 PM" หรือ "16:00"
    room,
    instructors,      // array รายชื่ออาจารย์
  } = body || {};

  if (!courseCode || !courseName || !date) {
    return NextResponse.json(
      { ok: false, error: "missing courseCode / courseName / date" },
      { status: 400 }
    );
  }

  // แปลงวันเริ่ม
  const startDate = new Date(date);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: "invalid date" },
      { status: 400 }
    );
  }

  // จำนวนนวันอบรม
  const dayCnt = Number(dayCount) || 1;

  // เตรียม instructors ให้เป็น { name, email }
  const instructorList = (instructors || []).map((ins) => {
    if (typeof ins === "string") {
      return { name: ins, email: "" };
    }
    return {
      name: ins.name || ins.fullname || "",
      email: ins.email || "",
    };
  });

  const doc = await Class.create({
    source: "manual",                     // ให้รู้ว่ามาจาก Manual
    publicCourseId: publicCourseId || null,
    courseCode,
    courseName,
    title: title || courseName,
    date: startDate,
    duration: {
      dayCount: dayCnt,
      startTime,
      endTime,
    },
    room,
    instructors: instructorList,
  });

  return NextResponse.json({ ok: true, item: doc });
}
