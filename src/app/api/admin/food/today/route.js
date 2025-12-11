// src/app/api/food/today/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodDaySet from "@/models/FoodDaySet";
import Student from "@/models/Student";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

function normalizeDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const dayParam = searchParams.get("day");

  const day = Number(dayParam);
  const hasDay = Number.isFinite(day) && day > 0;

  let targetDate = new Date();

  const applyOffset = (baseDate) => {
    const d = new Date(baseDate);
    if (hasDay) {
      d.setDate(d.getDate() + (day - 1));
    }
    return d;
  };

  // 1) มี classId → ใช้วันที่ของ Class
  if (classId) {
    const klass = await Class.findById(classId).select("date").lean();
    if (klass?.date) {
      targetDate = applyOffset(klass.date);
    }
  }
  // 2) มี studentId → หา class จาก Student
  else if (studentId) {
    const student = await Student.findById(studentId)
      .select("classId class")
      .lean();

    const cId = student?.classId || student?.class;
    if (cId) {
      const klass = await Class.findById(cId).select("date").lean();
      if (klass?.date) {
        targetDate = applyOffset(klass.date);
      }
    }
  }
  // 3) ไม่มีอะไรเลยแต่มี day → ขยับจากวันนี้
  else if (hasDay) {
    targetDate = applyOffset(targetDate);
  }

  const dayStart = normalizeDay(targetDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // ===== ใช้ FoodDaySet แบบใหม่ (entries) =====
  const daySet = await FoodDaySet.findOne({
    date: { $gte: dayStart, $lt: dayEnd },
  }).lean();

  let restaurantDocs;

  if (daySet && Array.isArray(daySet.entries) && daySet.entries.length > 0) {
    const restaurantIds = daySet.entries.map((e) => e.restaurant);
    restaurantDocs = await Restaurant.find({
      _id: { $in: restaurantIds },
      isActive: { $ne: false },
    }).lean();
  } else {
    // ไม่มี config → ใช้ร้าน active ทั้งหมดเหมือนเดิม
    restaurantDocs = await Restaurant.find({
      isActive: { $ne: false },
    }).lean();
  }

  const restaurantIds = restaurantDocs.map((r) => r._id);

  const menus = await FoodMenu.find({
    isActive: { $ne: false },
    restaurant: { $in: restaurantIds },
  }).lean();

  const map = new Map();

  restaurantDocs.forEach((r) => {
    map.set(String(r._id), {
      id: String(r._id),
      name: r.name,
      logoUrl: r.logoUrl,
      menus: [],
    });
  });

  menus.forEach((m) => {
    const key = String(m.restaurant);
    if (!map.has(key)) return;
    map.get(key).menus.push({
      id: String(m._id),
      name: m.name,
      imageUrl: m.imageUrl,
      addons: m.addons || [],
      drinks: m.drinks || [],
    });
  });

  const items = Array.from(map.values()).filter((r) => r.menus.length > 0);

  return NextResponse.json({ ok: true, items });
}
