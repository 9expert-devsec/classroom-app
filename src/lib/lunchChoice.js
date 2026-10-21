// src/lib/lunchChoice.js
// R2a-2: "ตัวเลือกอาหารปัจจุบันของผู้เรียน ของคลาส/วันนั้น" — pure (ไม่แตะ DB)
// ใช้ร่วมกันระหว่าง lunchActions.server.js / lunchAdmin.server.js (reopen) / orders API
// Student.food เก็บค่าเดียวต่อผู้เรียน (ประทับ classId + day) จึงต้องเช็คว่าเป็นของวันนั้นจริงก่อนใช้
import { computeDayIndexToday } from "@/lib/classDates";

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
