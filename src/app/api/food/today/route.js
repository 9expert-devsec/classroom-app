// /api/food/today/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { kioskGuard } from "@/lib/kioskAuth.server";
import Student from "@/models/Student";
import Class from "@/models/Class";

import { resolveClassDayYMD } from "@/lib/couponAvailability.server";
import { getFoodDayOptions } from "@/lib/foodDayOptions.server";
import { toBkkYMD, isCouponClosed } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import { todayFoodOf } from "@/lib/lunchChoice";

export const dynamic = "force-dynamic";

function toStr(x) {
  return x == null ? "" : String(x);
}

function buildCurrentFood(studentDoc) {
  const f = studentDoc?.food || {};
  const choiceType = toStr(f.choiceType || "");
  const restaurantId = toStr(f.restaurantId || "");
  const menuId = toStr(f.menuId || "");
  const addonIds = Array.isArray(f.addonIds)
    ? f.addonIds.map((x) => toStr(x))
    : [];
  const drinkId = toStr(f.drinkId || "");
  const note = toStr(f.note || "");
  const noFood = !!f.noFood;

  return {
    choiceType,
    restaurantId,
    menuId,
    addonIds,
    drinkId,
    note,
    noFood,
  };
}

export async function GET(req) {
  // L2a: kiosk session required, before any DB work or body parsing
  const denied = await kioskGuard(req);
  if (denied) return denied;

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const dayParam = searchParams.get("day");

    const day = Number(dayParam);
    const hasDay = Number.isFinite(day) && day > 0;

    // R4L-2: currentFood (prefill) คำนวณหลังรู้คลาสแล้ว — ดูด้านล่าง
    let currentFood = null;

    let classDoc = null;
    let classInfo = {
      courseName: "",
      classImageUrl: "",
      days: [],
      disableCoupon: false,
      classKind: "normal",
    };

    const buildClassInfo = (klass) => ({
      courseName: klass?.customCourseName || klass?.courseName || "",
      classImageUrl: klass?.classImageUrl || "",
      days: Array.isArray(klass?.days) ? klass.days : [],
      disableCoupon: !!klass?.disableCoupon,
      classKind: klass?.classKind || "normal",
    });

    // 1) classId
    if (classId) {
      const klass = await Class.findById(classId)
        .select(
          "date days dayCount duration.dayCount courseName customCourseName classImageUrl disableCoupon classKind",
        )
        .lean();
      if (klass) {
        classDoc = klass;
        classInfo = buildClassInfo(klass);
      }
    }
    // 2) studentId -> class
    else if (studentId) {
      const student = await Student.findById(studentId)
        .select("classId class")
        .lean();

      const cId = student?.classId || student?.class;
      if (cId) {
        const klass = await Class.findById(cId)
          .select(
            "date days dayCount duration.dayCount courseName customCourseName classImageUrl disableCoupon classKind",
          )
          .lean();
        if (klass) {
          classDoc = klass;
          classInfo = buildClassInfo(klass);
        }
      }
    }

    // ---------------------------
    // ✅ currentFood (prefill)
    // R4L-2: เฉพาะตัวเลือกของ "วันนี้" ของคลาสนี้ (todayFoodOf) — วันใหม่ / ยังไม่ได้เลือกวันนี้ = null
    //        (kiosk ไม่ prefill ของเมื่อวาน) · แก้ซ้ำวันเดียวกัน (edit-user) ยังได้ค่าที่บันทึกไว้วันนี้
    // ---------------------------
    if (studentId && classDoc) {
      const stu = await Student.findById(studentId).select("food").lean();
      // R4-2: แถว FoodChoice ของวันนี้
      const todayFood = stu ? await todayFoodOf(stu, classDoc) : null;
      if (todayFood) currentFood = buildCurrentFood({ food: todayFood });
    }

    // ✅ P1c: หาวันด้วย Bangkok day key แล้วค้น FoodDaySet ด้วย dayYMD
    //    (เอกสารที่ถูก supersede ไม่มี dayYMD จึงหาไม่เจอโดยอัตโนมัติ)
    const dayYMD = classDoc
      ? resolveClassDayYMD(classDoc, hasDay ? day : 1)
      : toBkkYMD(new Date());

    // R4-5A: ร้าน Set / เมนู / add-on / เครื่องดื่ม / คูปองของวัน มาจาก getFoodDayOptions
    //         (ตัวเดียวกับโมดัลแก้ไขอาหารของแอดมิน และการตรวจตอนบันทึก /api/checkin/food)
    //         คูปองยังเป็นกฎเดียว getCouponAvailability (เรียกจากในนั้น)
    const {
      hasFoodSetup,
      items,
      coupon: baseAvail,
    } = await getFoodDayOptions({ classDoc, dayYMD });

    // C2: ถึง 15:00 (เวลาไทยของ server ไม่ใช่นาฬิกาแท็บเล็ต) -> ไม่เสนอ Cash Coupon
    //     เหลือแค่ร้าน set กับ "ไม่รับอาหาร" เหมือนคลาสที่ปิดคูปองไว้
    const now = lunchNow();
    const couponClosed = isCouponClosed(toBkkYMD(now), now);
    const couponAvail = couponClosed
      ? { ...baseAvail, available: false, reason: "coupon_closed", couponRestaurants: [] }
      : baseAvail;

    // ✅ RULE: ถ้าไม่มีการตั้งค่าใน Calendar → ไม่มีร้าน/เมนูวันนี้ (hasFoodSetup = false, items = [])
    return NextResponse.json({
      ok: true,
      hasFoodSetup,
      items,
      currentFood, // ✅ NEW
      classInfo,
      dayYMD,
      couponAvailable: couponAvail.available,
      couponUnavailableReason: couponAvail.reason,
      couponRestaurants: couponAvail.couponRestaurants || [],
      couponClosed,
    });
  } catch (err) {
    console.error("GET /api/food/today error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
