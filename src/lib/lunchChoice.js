// src/lib/lunchChoice.js
// R2a-2: "ตัวเลือกอาหารปัจจุบันของผู้เรียน ของคลาส/วันนั้น" — pure (ไม่แตะ DB)
// ใช้ร่วมกันระหว่าง lunchActions.server.js / lunchAdmin.server.js (reopen) / orders API
// Student.food เก็บค่าเดียวต่อผู้เรียน (ประทับ classId + day) จึงต้องเช็คว่าเป็นของวันนั้นจริงก่อนใช้
// R4L-1: + todayFoodOf / todayClassDayOf — "ตัวเลือกของวันนี้" ตามนาฬิกาเดียวกับระบบ lunch (lunchNow)
//         ใช้ได้เฉพาะฝั่ง server (lunchNow อ่าน LUNCH_FAKE_NOW ได้นอก production)
import { computeDayIndexToday, classDayIndexToday } from "@/lib/classDates";
import { lunchNow } from "@/lib/lunchClock.server";

export const FOOD_CHOICE_MISMATCH_MESSAGE =
  "ข้อมูลอาหารของผู้เรียนไม่ใช่ของคลาส/วันนี้ กรุณาตรวจสอบใน Food Report";
export const FOOD_CHOICE_NOT_COUPON_MESSAGE =
  "ตัวเลือกอาหารปัจจุบันของผู้เรียนไม่ใช่คูปอง กรุณาตรวจสอบใน Food Report";

/**
 * Student.food ที่เป็นของ (classId, dayYMD) นี้ — ไม่ตรง / ไม่มี = null
 *   klass ต้องมี date / days / dayCount (หา day index ของ dayYMD)
 * คืน { food, dayIndex }
 */
export function currentChoiceFor(food, klass, classId, dayYMD) {
  if (!food || !klass) return null;
  const dayIndex = computeDayIndexToday(klass, String(dayYMD || ""));
  if (!dayIndex) return null;
  if (String(food.classId || "") !== String(classId || "")) return null;
  if (Number(food.day) !== dayIndex) return null;
  return { food, dayIndex };
}

/**
 * ปัญหาของการทำรายการคูปองกับตัวเลือกปัจจุบัน (null = ใช้ได้)
 *   strict = true  : แยก mismatch (ไม่ใช่ของวันนี้) กับ not_coupon (cancelCoupon)
 *   strict = false : ทุกกรณีที่ไม่ใช่คูปองของวันนี้ = food_choice_not_coupon (issue / reopen)
 */
export function couponChoiceProblem(food, klass, classId, dayYMD, { strict = false } = {}) {
  const cur = currentChoiceFor(food, klass, classId, dayYMD);
  if (!cur) {
    return strict
      ? { reason: "food_choice_mismatch", message: FOOD_CHOICE_MISMATCH_MESSAGE }
      : { reason: "food_choice_not_coupon", message: FOOD_CHOICE_NOT_COUPON_MESSAGE };
  }
  if (cur.food.choiceType !== "coupon") {
    return { reason: "food_choice_not_coupon", message: FOOD_CHOICE_NOT_COUPON_MESSAGE };
  }
  return null;
}

/* ---------------- R4L-1: ตัวเลือกอาหารของ "วันนี้" ---------------- */

// กติกา: นับตัวเลือกอาหารเป็นรายวัน — ทุกวันเรียนเริ่มว่างที่ kiosk ไม่ยกของเมื่อวานมา
// Student.food เก็บค่าเดียว (ถูกเขียนทับทุกวัน) จึงใช้ได้เฉพาะเมื่อประทับ classId + day ของวันนี้ตรงทั้งคู่

/** วันเรียนที่เท่าไรของคลาสนี้ ณ วันนี้ (เวลาไทย, นาฬิกา lunchNow) — ไม่ใช่วันเรียน = null */
export function todayClassDayOf(classDoc, now = lunchNow()) {
  if (!classDoc) return null;
  return classDayIndexToday(classDoc, now) || null;
}

/**
 * student.food เฉพาะเมื่อเป็นตัวเลือกของ "วันนี้" ของคลาสนี้ — ไม่ใช่ = null (ยังไม่ได้เลือกวันนี้)
 *   - food.classId ต้องเท่ากับ classDoc._id (ว่าง / ไม่มี = ไม่ตรง)
 *   - food.day ต้องเท่ากับวันเรียนของวันนี้ (ว่าง / ไม่มี = ไม่ตรง)
 *   - วันนี้ไม่ใช่วันเรียน = null
 * classDoc ต้องมี _id, date, days, dayCount / duration.dayCount
 */
export function todayFoodOf(student, classDoc, now = lunchNow()) {
  const food = student?.food;
  if (!food || !classDoc?._id) return null;

  const foodClassId = String(food.classId ?? "").trim();
  if (!foodClassId || foodClassId !== String(classDoc._id)) return null;

  if (food.day === null || food.day === undefined || food.day === "") return null;
  const day = todayClassDayOf(classDoc, now);
  if (!day || Number(food.day) !== day) return null;

  return food;
}
