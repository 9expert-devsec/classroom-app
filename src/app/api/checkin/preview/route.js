// src/app/api/checkin/preview/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";

export const dynamic = "force-dynamic";

function normalizeDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function applyDayOffset(baseDate, day) {
  // day 1 = baseDate, day 2 = baseDate+1, ...
  const d = new Date(baseDate);
  if (Number.isFinite(day) && day > 0) {
    d.setDate(d.getDate() + (day - 1));
  }
  return d;
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || searchParams.get("sid");
  const classIdParam =
    searchParams.get("classId") || searchParams.get("classid");
  const day = Number(searchParams.get("day") || 1);

  if (!studentId) {
    return NextResponse.json(
      { ok: false, error: "studentId is required" },
      { status: 400 }
    );
  }

  const student = await Student.findById(studentId).lean();
  if (!student) {
    return NextResponse.json(
      { ok: false, error: "Student not found" },
      { status: 404 }
    );
  }

  // ----- ข้อมูล Class -----
  let klass = null;
  const classId = classIdParam || student.classId;
  if (classId) {
    klass = await Class.findById(classId).lean();
  }

  let classInfo = null;
  if (klass) {
    const baseDate = klass.date ? new Date(klass.date) : null;
    let dayDate = null;
    if (baseDate) {
      dayDate = applyDayOffset(baseDate, day);
    }

    classInfo = {
      // พยายามรองรับหลายชื่อ field เผื่อ schema ต่างจากนี้
      courseName:
        klass.courseName || klass.className || klass.title || klass.name || "",
      room: klass.roomName || klass.room || klass.roomTitle || "",
      dayLabel: `Day ${day}`,
      dayDate: dayDate
        ? dayDate.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "",
    };
  }

  // ----- ข้อมูล User -----
  const userInfo = {
    // ใช้ thaiName / engName ตาม schema ที่ส่งมา
    studentName: student.thaiName || student.engName || "",
    engName: student.engName || "",
    company: student.company || "",
  };

  // ----- ข้อมูลอาหาร (อ่านจาก student.food) -----
  let foodPreview = null;

  if (student.food && student.food.restaurantId && student.food.menuId) {
    const [restaurant, menu] = await Promise.all([
      Restaurant.findById(student.food.restaurantId).lean(),
      FoodMenu.findById(student.food.menuId).lean(),
    ]);

    foodPreview = {
      restaurantName: restaurant?.name || "",
      menuName: menu?.name || "",
      addons: student.food.addons || [],
      drink: student.food.drink || "",
      note: student.food.note || "",
    };
  }

  return NextResponse.json({
    ok: true,
    user: userInfo,
    classInfo,
    food: foodPreview,
  });
}
