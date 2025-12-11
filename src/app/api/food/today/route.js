// src/app/api/food/today/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodDaySet from "@/models/FoodDaySet";
import FoodSet from "@/models/FoodSet";
import Student from "@/models/Student";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

function normalizeDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const dayParam = searchParams.get("day");

    const day = Number(dayParam);
    const hasDay = Number.isFinite(day) && day > 0;

    let targetDate = new Date();

    // helper: เอา baseDate + offset (day 1 = +0, day 2 = +1, ...)
    const applyOffset = (baseDate) => {
      const d = new Date(baseDate);
      if (hasDay) {
        d.setDate(d.getDate() + (day - 1));
      }
      return d;
    };

    // 1) มี classId → ใช้ date จาก Class แล้วขยับตาม day
    if (classId) {
      const klass = await Class.findById(classId).select("date").lean();
      if (klass?.date) {
        targetDate = applyOffset(klass.date);
      }
    }
    // 2) มี studentId → เด้งไปหา class จาก Student
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
    // 3) ไม่มี class/student แต่มี day → ขยับจากวันนี้
    else if (hasDay) {
      targetDate = applyOffset(targetDate);
    }

    const dayStart = normalizeDay(targetDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // หา config ของวันนั้นจาก FoodDaySet (Calendar)
    const daySet = await FoodDaySet.findOne({
      date: { $gte: dayStart, $lt: dayEnd },
    })
      .lean();

    let restaurants = [];
    const setMenuMap = new Map(); // key = restaurantId(string), value = array menuId(string) ที่อนุญาต

    if (daySet && Array.isArray(daySet.entries) && daySet.entries.length > 0) {
      // มี config จาก calendar แล้ว
      const restaurantIds = daySet.entries.map((e) => e.restaurant);
      // ดึงร้านที่ยัง active
      restaurants = await Restaurant.find({
        _id: { $in: restaurantIds },
        isActive: { $ne: false },
      }).lean();

      // ถ้ามี set ให้ดึง FoodSet มาดูว่า menuIds อะไร
      const setIds = daySet.entries
        .map((e) => e.set)
        .filter(Boolean);

      if (setIds.length > 0) {
        const sets = await FoodSet.find({ _id: { $in: setIds } }).lean();
        const setsMap = new Map(
          sets.map((s) => [String(s._id), s])
        );

        daySet.entries.forEach((entry) => {
          if (!entry.set) return;
          const setDoc = setsMap.get(String(entry.set));
          if (!setDoc) return;

          const restKey = String(entry.restaurant);
          const menuIds = (setDoc.menuIds || []).map((id) => String(id));

          if (menuIds.length > 0) {
            setMenuMap.set(restKey, menuIds);
          }
        });
      }
    } else {
      // ถ้า Calendar ยังไม่ตั้งค่า → fallback ร้าน active ทั้งหมด
      restaurants = await Restaurant.find({
        isActive: { $ne: false },
      }).lean();
    }

    const restaurantIds = restaurants.map((r) => r._id);

    const menus = await FoodMenu.find({
      isActive: { $ne: false },
      restaurant: { $in: restaurantIds },
    }).lean();

    // ประกอบข้อมูลตามร้าน
    const map = new Map();

    restaurants.forEach((r) => {
      map.set(String(r._id), {
        id: String(r._id),
        name: r.name,
        logoUrl: r.logoUrl,
        menus: [],
      });
    });

    menus.forEach((m) => {
      const restKey = String(m.restaurant);
      if (!map.has(restKey)) return;

      // ถ้าวันนี้มี config Set สำหรับร้านนี้ ให้ filter ตรงนี้
      const allowedMenuIds = setMenuMap.get(restKey);
      if (
        Array.isArray(allowedMenuIds) &&
        allowedMenuIds.length > 0 &&
        !allowedMenuIds.includes(String(m._id))
      ) {
        return; // เมนูนี้ไม่ได้อยู่ใน set ของวันนั้น → skip
      }

      map.get(restKey).menus.push({
        id: String(m._id),
        name: m.name,
        imageUrl: m.imageUrl,
        addons: m.addons || [],
        drinks: m.drinks || [],
      });
    });

    const items = Array.from(map.values()).filter(
      (r) => r.menus.length > 0
    );

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/food/today error:", err);
    // ป้องกัน res.json ฝั่ง client พัง → คืน JSON เสมอ
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
