// src/app/api/admin/food-orders/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Checkin from "@/models/Checkin";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import Class from "@/models/Class";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

// ทำให้ query by "YYYY-MM-DD" เป็นวันตามเวลาไทยจริง ๆ
function startOfDayBKK(ymd) {
  return new Date(`${ymd}T00:00:00.000+07:00`);
}

function cleanLower(x) {
  return String(x || "")
    .trim()
    .toLowerCase();
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD
  const classId = searchParams.get("classId");
  const q = cleanLower(searchParams.get("q"));

  if (!dateStr) {
    return NextResponse.json(
      { ok: false, error: "date is required" },
      { status: 400 },
    );
  }

  const start = startOfDayBKK(dateStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const match = { time: { $gte: start, $lt: end } };
  if (classId && classId !== "all") match.classId = classId;

  const checkins = await Checkin.find(match)
    .populate({ path: "classId", model: Class })
    .populate({ path: "studentId", model: Student })
    .lean();

  if (!checkins.length) {
    return NextResponse.json({
      ok: true,
      items: [],
      total: 0,
      summary: {
        total: 0,
        couponCount: 0,
        noFoodCount: 0,
        menuCounts: [
          { label: "Cash Coupon", count: 0 },
          { label: "ไม่รับอาหาร", count: 0 },
        ],
      },
    });
  }

  // เก็บ id ร้าน + เมนู ที่ต้องไปดึงชื่อมา
  const restaurantIds = new Set();
  const menuIds = new Set();

  for (const ch of checkins) {
    const stuFood = ch.studentId?.food || {};
    if (stuFood.restaurantId) restaurantIds.add(String(stuFood.restaurantId));
    if (stuFood.menuId) menuIds.add(String(stuFood.menuId));
  }

  const restaurantDocs = restaurantIds.size
    ? await Restaurant.find({ _id: { $in: [...restaurantIds] } })
        .select("name")
        .lean()
    : [];

  const menuDocs = menuIds.size
    ? await FoodMenu.find({ _id: { $in: [...menuIds] } })
        .select("name restaurant")
        .lean()
    : [];

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

    const choiceType = cleanLower(stuFood.choiceType); // food | nofood | coupon | ""
    const note = String(stuFood.note || "");

    const noteLower = cleanLower(note);
    const isCoupon = choiceType === "coupon" || noteLower.includes("coupon");

    // ✅ hasSelection: note ไม่ถือว่า "เลือกอาหาร" เพื่อกันเพี้ยน
    const hasSelection =
      !!stuFood.menuId ||
      !!stuFood.restaurantId ||
      !!stuFood.drink ||
      (Array.isArray(stuFood.addons) && stuFood.addons.length > 0);

    // ✅ noFood แยกจาก coupon ชัด ๆ
    const isNoFood =
      !isCoupon &&
      (choiceType === "nofood" || stuFood.noFood === true || !hasSelection);

    const menuInfo = stuFood.menuId ? menuMap[String(stuFood.menuId)] : null;

    const restNameFromFood = stuFood.restaurantId
      ? restaurantMap[String(stuFood.restaurantId)] || ""
      : "";

    const restNameFromMenu = menuInfo?.restaurantId
      ? restaurantMap[String(menuInfo.restaurantId)] || ""
      : "";

    const restaurantName =
      isCoupon || isNoFood ? "" : restNameFromFood || restNameFromMenu || "";

    const menuName = isCoupon || isNoFood ? "" : menuInfo?.name || "";

    return {
      id: String(ch._id),
      _id: String(ch._id),
      date: ch.time,

      classId: cls?._id ? String(cls._id) : "",
      className: cls.title || cls.className || "",
      classTitle: cls.title || "",
      courseCode: cls.courseCode || "",
      roomName: cls.roomName || cls.room || "",
      classDate: cls.date || cls.startDate || null,

      studentId: stu?._id ? String(stu._id) : "",
      studentName: stu.name || stu.thaiName || stu.engName || "",
      studentThaiName: stu.thaiName || "",
      studentEngName: stu.engName || "",
      company: stu.company || "",

      // ✅ สถานะหลัก
      choiceType: isCoupon ? "coupon" : isNoFood ? "noFood" : "food",
      isCoupon,
      isNoFood,

      restaurantId: stuFood.restaurantId ? String(stuFood.restaurantId) : "",
      menuId: stuFood.menuId ? String(stuFood.menuId) : "",

      restaurantName,
      menuName,

      food: {
        choiceType: isCoupon ? "coupon" : isNoFood ? "noFood" : "food",
        coupon: isCoupon,
        noFood: isNoFood,
        restaurantId: stuFood.restaurantId ? String(stuFood.restaurantId) : "",
        menuId: stuFood.menuId ? String(stuFood.menuId) : "",
        addons: Array.isArray(stuFood.addons) ? stuFood.addons : [],
        drink: stuFood.drink || "",
        note: stuFood.note || "",
      },

      addons: Array.isArray(stuFood.addons) ? stuFood.addons : [],
      drink: stuFood.drink || "",
      note: stuFood.note || "",
    };
  });

  // search filter
  if (q) {
    items = items.filter((row) => {
      const haystack = [
        row.studentName,
        row.studentThaiName,
        row.studentEngName,
        row.company,
        row.className,
        row.courseCode,
        row.roomName,
        row.restaurantName,
        row.menuName,
        Array.isArray(row.addons) ? row.addons.join(" ") : "",
        row.drink,
        row.note,
        row.isNoFood ? "ไม่รับอาหาร" : "",
        row.isCoupon ? "coupon" : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }

  // ✅ summary เมนูรวม (แยก coupon/noFood)
  let noFoodCount = 0;
  let couponCount = 0;
  const counter = new Map();

  for (const row of items) {
    if (row.isCoupon) {
      couponCount += 1;
      continue;
    }
    if (row.isNoFood || !row.menuName) {
      noFoodCount += 1;
      continue;
    }
    const label = row.restaurantName
      ? `${row.restaurantName} — ${row.menuName}`
      : row.menuName;

    counter.set(label, (counter.get(label) || 0) + 1);
  }

  const menuCounts = Array.from(counter.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));

  // ใส่ coupon/noFood เป็นแถวแรก
  menuCounts.unshift({ label: "ไม่รับอาหาร", count: noFoodCount });
  menuCounts.unshift({ label: "Cash Coupon", count: couponCount });

  return NextResponse.json({
    ok: true,
    items,
    total: items.length,
    summary: {
      total: items.length,
      couponCount,
      noFoodCount,
      menuCounts,
    },
  });
}
