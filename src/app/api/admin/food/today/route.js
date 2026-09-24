// src/app/api/admin/food/today/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodDaySet from "@/models/FoodDaySet";
import Student from "@/models/Student";
import Class from "@/models/Class";

import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

import {
  resolveClassDayYMD,
  getDaySet,
} from "@/lib/couponAvailability.server";
import { toBkkYMD } from "@/lib/lunchConfig";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const dayParam = searchParams.get("day");

  const day = Number(dayParam);
  const hasDay = Number.isFinite(day) && day > 0;

  let classDoc = null;

  // 1) มี classId → ใช้วันที่ของ Class
  if (classId) {
    classDoc = await Class.findById(classId).select("date days").lean();
  }
  // 2) มี studentId → หา class จาก Student
  else if (studentId) {
    const student = await Student.findById(studentId)
      .select("classId class")
      .lean();
    const cId = student?.classId || student?.class;
    if (cId) {
      classDoc = await Class.findById(cId).select("date days").lean();
    }
  }

  // ✅ P1c: หา FoodDaySet ด้วย dayYMD (เอกสารที่ถูก supersede ไม่มี dayYMD
  //    จึงถูกกรองออกเอง ไม่ต้องใส่เงื่อนไข supersededBy เพิ่ม)
  const dayYMD = classDoc
    ? resolveClassDayYMD(classDoc, hasDay ? day : 1)
    : toBkkYMD(new Date());

  const daySet = await getDaySet(dayYMD);

  let restaurantDocs;
  if (daySet && Array.isArray(daySet.entries) && daySet.entries.length > 0) {
    const restaurantIds = daySet.entries
      .filter((e) => (e.mode || "set") === "set")
      .map((e) => e.restaurant);
    restaurantDocs = await Restaurant.find({
      _id: { $in: restaurantIds },
      isActive: { $ne: false },
    }).lean();
  } else {
    restaurantDocs = await Restaurant.find({ isActive: { $ne: false } }).lean();
  }

  const restaurantIds = restaurantDocs.map((r) => r._id);

  // ✅ ดึงเมนูวันนี้ + เก็บ addonIds/drinkIds (สำคัญ)
  const menus = await FoodMenu.find({
    isActive: { $ne: false },
    restaurant: { $in: restaurantIds },
  }).lean();

  // ✅ รวม id ที่ถูกอ้างอิงโดยเมนูวันนี้ เพื่อ query options
  const refAddonIds = new Set();
  const refDrinkIds = new Set();

  menus.forEach((m) => {
    (Array.isArray(m.addonIds) ? m.addonIds : []).forEach((id) =>
      refAddonIds.add(String(id)),
    );
    (Array.isArray(m.drinkIds) ? m.drinkIds : []).forEach((id) =>
      refDrinkIds.add(String(id)),
    );
  });

  const [addonDocs, drinkDocs] = await Promise.all([
    refAddonIds.size
      ? FoodAddon.find({ _id: { $in: Array.from(refAddonIds) } })
          .select("name")
          .lean()
      : [],
    refDrinkIds.size
      ? FoodDrink.find({ _id: { $in: Array.from(refDrinkIds) } })
          .select("name")
          .lean()
      : [],
  ]);

  const addonOptions = addonDocs.map((x) => ({
    id: String(x._id),
    name: x.name || "-",
  }));
  const drinkOptions = drinkDocs.map((x) => ({
    id: String(x._id),
    name: x.name || "-",
  }));

  // ===== build items =====
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

      // ✅ ส่ง ids ไปด้วย (ให้ UI ส่งกลับไป /api/checkin/food ได้)
      addonIds: Array.isArray(m.addonIds) ? m.addonIds.map(String) : [],
      drinkIds: Array.isArray(m.drinkIds) ? m.drinkIds.map(String) : [],

      // legacy เผื่อ UI/รายงานเก่า
      addons: m.addons || [],
      drinks: m.drinks || [],
    });
  });

  const items = Array.from(map.values()).filter((r) => r.menus.length > 0);

  return NextResponse.json({
    ok: true,
    items,
    addons: addonOptions,
    drinks: drinkOptions,
  });
}
