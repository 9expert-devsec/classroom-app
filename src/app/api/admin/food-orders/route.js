// src/app/api/admin/food-orders/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Checkin from "@/models/Checkin";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const classId = searchParams.get("classId");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!dateStr) {
    return NextResponse.json(
      { ok: false, error: "date is required" },
      { status: 400 }
    );
  }

  // ช่วงเวลา 1 วัน
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const match = {
    time: { $gte: start, $lt: end },
  };
  if (classId && classId !== "all") {
    match.classId = classId;
  }

  // ดึง check-in พร้อม student + class
  const checkins = await Checkin.find(match)
    .populate("classId")
    .populate("studentId")
    .lean();

  if (!checkins.length) {
    return NextResponse.json({ ok: true, items: [], total: 0 });
  }

  // เก็บ id ร้าน + เมนู ที่ต้องไปดึงชื่อมา
  const restaurantIds = new Set();
  const menuIds = new Set();

  for (const ch of checkins) {
    const stuFood = ch.studentId?.food || {};
    if (stuFood.restaurantId) restaurantIds.add(stuFood.restaurantId);
    if (stuFood.menuId) menuIds.add(stuFood.menuId);
  }

  const restaurantDocs = await Restaurant.find({
    _id: { $in: [...restaurantIds] },
  }).lean();

  const menuDocs = await FoodMenu.find({
    _id: { $in: [...menuIds] },
  })
    .populate("restaurant")
    .lean();

  const restaurantMap = {};
  for (const r of restaurantDocs) {
    restaurantMap[String(r._id)] = r.name;
  }

  const menuMap = {};
  for (const m of menuDocs) {
    menuMap[String(m._id)] = {
      name: m.name,
      restaurantId: m.restaurant ? String(m.restaurant) : null,
    };
  }

  // แปลงเป็น row สำหรับ report
  let items = checkins.map((ch) => {
    const stu = ch.studentId || {};
    const cls = ch.classId || {};
    const stuFood = stu.food || {};

    const menuInfo = menuMap[stuFood.menuId] || {};
    const restaurantName =
      restaurantMap[stuFood.restaurantId] ||
      (menuInfo.restaurantId ? restaurantMap[menuInfo.restaurantId] : "") ||
      "-";

    return {
      id: String(ch._id),
      date: ch.time,
      classId: cls?._id ? String(cls._id) : "",
      classTitle: cls.title || "",
      courseCode: cls.courseCode || "",

      studentThaiName: stu.thaiName || "",
      studentEngName: stu.engName || "",
      company: stu.company || "",

      restaurantName, // ✅ ชื่อร้าน
      menuName: menuInfo.name || "", // ✅ ชื่อเมนู
      addons: (stuFood.addons || []).join(", "),
      drink: stuFood.drink || "",
      note: stuFood.note || "",
    };
  });

  // filter จากช่องค้นหา
  if (q) {
    items = items.filter((row) => {
      const haystack = [
        row.studentThaiName,
        row.studentEngName,
        row.company,
        row.restaurantName,
        row.menuName,
        row.addons,
        row.drink,
        row.note,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return NextResponse.json({
    ok: true,
    items,
    total: items.length,
  });
}
