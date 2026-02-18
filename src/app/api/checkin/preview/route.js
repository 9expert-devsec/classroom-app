// src/app/api/checkin/preview/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

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
      { status: 400 },
    );
  }

  const student = await Student.findById(studentId).lean();
  if (!student) {
    return NextResponse.json(
      { ok: false, error: "Student not found" },
      { status: 404 },
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

  const sf = student.food || null;
  if (sf) {
    const choiceType = String(sf.choiceType || "");
    const noFood = !!sf.noFood;
    const isCoupon = choiceType === "coupon" || !!sf.coupon;

    // 1) เคส coupon / noFood
    if (isCoupon) {
      foodPreview = {
        choiceType: "coupon",
        restaurantName: "",
        menuName: "",
        addons: [],
        drink: "",
        note: sf.note || "COUPON",
      };
    } else if (choiceType === "noFood" || noFood) {
      foodPreview = {
        choiceType: "noFood",
        restaurantName: "",
        menuName: "",
        addons: [],
        drink: "",
        note: sf.note || "ไม่รับอาหาร",
      };
    } else {
      // 2) เคส food
      const restaurantId = sf.restaurantId;
      const menuId = sf.menuId;

      let restaurant = null;
      let menu = null;

      if (restaurantId)
        restaurant = await Restaurant.findById(restaurantId).lean();
      if (menuId) menu = await FoodMenu.findById(menuId).lean();

      const addonIds = Array.isArray(sf.addonIds)
        ? sf.addonIds.map(String)
        : [];
      const drinkId = String(sf.drinkId || "");

      const [addonDocs, drinkDoc] = await Promise.all([
        addonIds.length
          ? FoodAddon.find({ _id: { $in: addonIds } })
              .select("name")
              .lean()
          : [],
        drinkId ? FoodDrink.findById(drinkId).select("name").lean() : null,
      ]);

      // const addonNameById = new Map(
      //   (restaurant?.addons || []).map((a) => [
      //     String(a._id || a.id),
      //     a.name || "",
      //   ]),
      // );
      // const drinkNameById = new Map(
      //   (restaurant?.drinks || []).map((d) => [
      //     String(d._id || d.id),
      //     d.name || "",
      //   ]),
      // );

      const addons = addonDocs.map((x) => x.name).filter(Boolean);
      const drink = drinkDoc?.name ? String(drinkDoc.name) : "";

      foodPreview = {
        choiceType: "food",
        restaurantName: restaurant?.name || "",
        menuName: menu?.name || "",
        addons,
        addonIds,
        drink,
        drinkId,
        note: sf.note || "",
      };
    }
  }

  return NextResponse.json({
    ok: true,
    user: userInfo,
    classInfo,
    food: foodPreview,
  });
}
