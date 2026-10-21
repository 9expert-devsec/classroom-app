// src/lib/lunchChoice.js
// R2a-2: "ตัวเลือกอาหารปัจจุบันของผู้เรียน ของคลาส/วันนั้น"
// R4-2: อ่านจาก FoodChoice (แถวรายวัน) ทั้งหมด — ไม่อ่าน Student.food อีกแล้ว (server only)
// ใช้ร่วมกันระหว่าง lunchActions.server.js / lunchAdmin.server.js (reopen) / orders API
// Student.food เก็บค่าเดียวต่อผู้เรียน (ประทับ classId + day) จึงต้องเช็คว่าเป็นของวันนั้นจริงก่อนใช้
// R4L-1: + todayFoodOf / todayClassDayOf — "ตัวเลือกของวันนี้" ตามนาฬิกาเดียวกับระบบ lunch (lunchNow)
//         ใช้ได้เฉพาะฝั่ง server (lunchNow อ่าน LUNCH_FAKE_NOW ได้นอก production)
// R4-2: todayFoodOf อ่านจาก FoodChoice (async)
import { computeDayIndexToday } from "@/lib/classDates";
import { lunchNow } from "@/lib/lunchClock.server";
import { getFoodChoice, getTodayFoodChoice, todayClassDayOf } from "@/lib/foodChoice.server";

// R4-2: ไม่มีแถว FoodChoice ของคลาส/วันนั้น = ผู้เรียนยังไม่มีตัวเลือกอาหารของวันนั้น
export const FOOD_CHOICE_MISMATCH_MESSAGE =
  "ยังไม่มีตัวเลือกอาหารของผู้เรียนสำหรับคลาส/วันนี้ กรุณาตรวจสอบใน Food Report";
export const FOOD_CHOICE_NOT_COUPON_MESSAGE =
  "ตัวเลือกอาหารปัจจุบันของผู้เรียนไม่ใช่คูปอง กรุณาตรวจสอบใน Food Report";

/** วันเรียนที่เท่าไรของ dayYMD ในคลาสนี้ (ไม่ใช่วันเรียน = null) */
export function classDayIndexOf(klass, dayYMD) {
  if (!klass) return null;
  return computeDayIndexToday(klass, String(dayYMD || "")) || null;
}

/**
 * R4-2: ตัวเลือกอาหารของ (ผู้เรียน, คลาส, dayYMD) = แถว FoodChoice ของวันเรียนนั้น — ไม่มี = null
 *   klass ต้องมี date / days / dayCount (หา day index ของ dayYMD)
 * คืน { food: แถว FoodChoice, dayIndex }
 */
export async function currentChoiceFor({ studentId, klass, classId, dayYMD, session = null }) {
  const dayIndex = classDayIndexOf(klass, dayYMD);
  if (!dayIndex || !studentId || !classId) return null;
  const food = await getFoodChoice({ studentId, classId, day: dayIndex }, { session });
  return food ? { food, dayIndex } : null;
}

/**
 * ปัญหาของการทำรายการคูปองกับตัวเลือก (แถว FoodChoice หรือ null) — pure, null = ใช้ได้
 *   strict = true  : แยก mismatch (ยังไม่มีตัวเลือกของวันนั้น) กับ not_coupon (cancelCoupon)
 *   strict = false : ทุกกรณีที่ไม่ใช่คูปองของวันนั้น = food_choice_not_coupon (issue / reopen / reassign)
 */
export function couponProblemOfChoice(choice, { strict = false } = {}) {
  if (!choice) {
    return strict
      ? { reason: "food_choice_mismatch", message: FOOD_CHOICE_MISMATCH_MESSAGE }
      : { reason: "food_choice_not_coupon", message: FOOD_CHOICE_NOT_COUPON_MESSAGE };
  }
  if (choice.choiceType !== "coupon") {
    return { reason: "food_choice_not_coupon", message: FOOD_CHOICE_NOT_COUPON_MESSAGE };
  }
  return null;
}

/** R4-2: เหมือน couponProblemOfChoice แต่โหลดแถว FoodChoice ของ (ผู้เรียน, คลาส, dayYMD) เอง */
export async function couponChoiceProblem({
  studentId,
  klass,
  classId,
  dayYMD,
  strict = false,
  session = null,
}) {
  const cur = await currentChoiceFor({ studentId, klass, classId, dayYMD, session });
  return couponProblemOfChoice(cur?.food || null, { strict });
}

/* ---------------- R4L-1 / R4-2A: ตัวเลือกอาหารของ "วันนี้" ---------------- */

// กติกา: นับตัวเลือกอาหารเป็นรายวัน — ทุกวันเรียนเริ่มว่างที่ kiosk ไม่ยกของเมื่อวานมา
// R4-2A: อ่านจาก FoodChoice (แถวของวันนี้) — ไม่อ่าน Student.food อีกแล้ว
//        todayClassDayOf ย้ายไปอยู่ foodChoice.server.js (re-export ที่นี่ให้ผู้ใช้เดิม)

export { todayClassDayOf };

/**
 * ตัวเลือกอาหารของ "วันนี้" ของคลาสนี้ (แถว FoodChoice) — ไม่ใช่วันเรียน / ยังไม่ได้เลือกวันนี้ = null
 * async (R4-2A) · student ต้องมี _id · classDoc ต้องมี _id, date, days, dayCount / duration.dayCount
 * แถวมี field อาหารรูปเดียวกับ Student.food (choiceType, restaurantId, menuId, addonIds, drinkId, note ...)
 */
export async function todayFoodOf(student, classDoc, now = lunchNow(), { session = null } = {}) {
  return getTodayFoodChoice({ student, classDoc, now, session });
}
