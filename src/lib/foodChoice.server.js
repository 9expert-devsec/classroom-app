// src/lib/foodChoice.server.js
//
// R4: ตัวเลือกอาหารรายวัน (FoodChoice) — ทางเดียวทั้งอ่านและเขียน
//
// เขียน (R4-1): saveTodayFoodChoice
//   - FoodChoice (รายวัน: ผู้เรียน + คลาส + วันเรียน) upsert ค่าใหม่
//   - Student.food เขียนเหมือนเดิมทุกตัวอักษร (mirror ของวันนี้ — branch main อ่าน/เขียน field นี้
//     จึงต้องคงไว้เพื่อ rollback ได้) · แอปไม่อ่าน Student.food เป็น "ตัวเลือกของวัน" อีกแล้ว (R4-2)
//   ทั้งสองอย่างอยู่ใน transaction ของผู้เรียก (session) เสมอ
//   แก้ได้เฉพาะ "วันนี้" — วันเรียนของวันนี้มาจาก todayClassDayOf (นาฬิกา lunch) และ food.day ต้องตรง
//   FoodEditLog / AuditLog ไม่ได้อยู่ที่นี่ (ผู้เรียกเขียนเหมือนเดิมหลัง commit)
//
// อ่าน (R4-2): getFoodChoice / getTodayFoodChoice / getFoodChoicesForRange
//   ไม่มีแถว = วันนั้นยังไม่ได้เลือก (ไม่มีการยกของวันก่อนมา)
//
// ไฟล์นี้ห้าม import lunchChoice.js / lunchAdmin.server.js (สองไฟล์นั้น import ไฟล์นี้)
import FoodChoice from "@/models/FoodChoice";
import Student from "@/models/Student";

import { LunchAdminError } from "@/lib/lunchErrors";
import { classDayIndexToday, classDayYMD } from "@/lib/classDates";
import { lunchNow } from "@/lib/lunchClock.server";

export const PAST_DAY_EDIT_MESSAGE = "แก้ไขได้เฉพาะตัวเลือกอาหารของวันนี้";

/* ---------------- day ---------------- */

/** วันเรียนที่เท่าไรของคลาสนี้ ณ วันนี้ (เวลาไทย, นาฬิกา lunchNow) — ไม่ใช่วันเรียน = null */
export function todayClassDayOf(classDoc, now = lunchNow()) {
  if (!classDoc) return null;
  return classDayIndexToday(classDoc, now) || null;
}

/** key ของแถวใน map: studentId|classId|day */
export function foodChoiceKey(studentId, classId, day) {
  return `${String(studentId)}|${String(classId)}|${Number(day)}`;
}

/* ---------------- read ---------------- */

/** แถว FoodChoice ของ (ผู้เรียน, คลาส, วันเรียน) หรือ null */
export async function getFoodChoice({ studentId, classId, day }, { session = null } = {}) {
  const d = Number(day);
  if (!studentId || !classId || !Number.isInteger(d) || d < 1) return null;
  return FoodChoice.findOne({ studentId, classId, day: d }).session(session).lean();
}

/**
 * แถว FoodChoice ของ "วันนี้" ของคลาสนี้ (นาฬิกา lunch) — ไม่ใช่วันเรียน / ยังไม่ได้เลือก = null
 * student ต้องมี _id · classDoc ต้องมี _id, date, days, dayCount / duration.dayCount
 */
export async function getTodayFoodChoice({ student, classDoc, now = lunchNow(), session = null }) {
  if (!student?._id || !classDoc?._id) return null;
  const day = todayClassDayOf(classDoc, now);
  if (!day) return null;
  return getFoodChoice({ studentId: student._id, classId: classDoc._id, day }, { session });
}

/**
 * แถว FoodChoice ทั้งหมดในช่วงวัน (dayYMD ระหว่าง fromYMD..toYMD) — query เดียว
 * classIds (ไม่บังคับ) จำกัดเฉพาะคลาสเหล่านี้ (ใช้ index classId + dayYMD)
 * คืน Map key = foodChoiceKey(studentId, classId, day)
 */
export async function getFoodChoicesForRange({ classIds = null, fromYMD, toYMD }) {
  const from = String(fromYMD || "").slice(0, 10);
  const to = String(toYMD || from).slice(0, 10);
  const out = new Map();
  if (!from) return out;

  const q = { dayYMD: { $gte: from, $lte: to } };
  if (Array.isArray(classIds)) {
    if (!classIds.length) return out;
    q.classId = { $in: classIds };
  }
  const rows = await FoodChoice.find(q).lean();
  for (const r of rows) out.set(foodChoiceKey(r.studentId, r.classId, r.day), r);
  return out;
}

/* ---------------- write ---------------- */

/** เฉพาะ field อาหาร (รูปเดียวกับ Student.food) ของ FoodChoice */
export function pickFoodChoiceFields(food) {
  const f = food || {};
  const strArr = (a) => (Array.isArray(a) ? a.map((x) => String(x)) : []);
  return {
    choiceType: ["food", "noFood", "coupon"].includes(f.choiceType) ? f.choiceType : "",
    noFood: f.noFood === undefined ? true : !!f.noFood,
    restaurantId: String(f.restaurantId || ""),
    menuId: String(f.menuId || ""),
    addons: strArr(f.addons),
    drink: String(f.drink || ""),
    addonIds: strArr(f.addonIds),
    drinkId: String(f.drinkId || ""),
    note: String(f.note || ""),
  };
}

/** แหล่งที่มาของการบันทึก จาก ctx ของ route (แท็บเล็ต = kiosk, แอดมิน = admin) */
export function foodChoiceSourceOf(ctx) {
  if (ctx?.kiosk) return "kiosk";
  if (ctx?.user?.id || ctx?.userId || ctx?.user?.username) return "admin";
  return "system";
}

function actorLabelOf(ctx) {
  return String(ctx?.user?.username || ctx?.user?.name || "").trim();
}

/** E11000 จาก unique index (studentId, classId, day) ของ food_choices เท่านั้น */
function isFoodChoiceKeyCollision(err) {
  const e = err?.code === 11000 ? err : err?.cause?.code === 11000 ? err.cause : null;
  if (!e) return false;
  const kp = e.keyPattern || e.keyValue;
  if (kp && typeof kp === "object") {
    return "studentId" in kp && "classId" in kp && "day" in kp;
  }
  return /index:\s*studentId_1_classId_1_day_1\b/.test(String(e.errmsg || e.message || ""));
}

// transaction ที่เคยชน unique key แล้วหนึ่งครั้ง (retry ครั้งเดียวต่อ session)
const retriedSessions = new WeakSet();

/**
 * บันทึกตัวเลือกอาหารของ "วันนี้" — FoodChoice (upsert) + Student.food (mirror) ใน session เดียวกัน
 *   student  : ต้องมี _id
 *   classDoc : ต้องมี _id, date, days, dayCount / duration.dayCount
 *   food     : ค่า Student.food ตัวเต็ม (ต้องประทับ classId + day ของวันนี้)
 *   source   : kiosk | admin | reassign | system (ไม่ส่ง = ดูจาก actor)
 *   actor    : ctx ของ route (ไว้ลง updatedBy / เดา source)
 * ไม่ใช่วันเรียน / food ไม่ใช่ของวันนี้ -> LunchAdminError 409 (ไม่เขียนอะไรเลย)
 *
 * R4-2A: สองคนบันทึกพร้อมกันครั้งแรกของวัน -> upsert ทั้งคู่พยายาม insert แถวเดียวกัน -> E11000 (unique index)
 *   ไม่มี session : upsert ซ้ำอีกครั้ง (รอบนี้เจอแถวแล้ว = update) — ครั้งเดียว
 *   มี session    : E11000 ทำให้ transaction ตายไปแล้ว upsert ซ้ำใน transaction เดิมไม่ได้ ->
 *                   ติดป้าย TransientTransactionError ให้ withTransaction ของผู้เรียกทำทั้งก้อนใหม่ — ครั้งเดียว
 *   error อื่น (รวม E11000 ของ index อื่น) โยนต่อทันที
 */
export async function saveTodayFoodChoice(
  session,
  { student, classDoc, food, source, actor = null, now = lunchNow() },
) {
  if (!student?._id || !classDoc?._id) {
    throw new LunchAdminError(400, "bad_request", "ข้อมูลไม่ครบ");
  }
  const day = todayClassDayOf(classDoc, now);
  if (!day) {
    throw new LunchAdminError(409, "not_class_day", "วันนี้ไม่ใช่วันเรียนของคลาสนี้ จึงบันทึกตัวเลือกอาหารไม่ได้");
  }
  if (String(food?.classId || "") !== String(classDoc._id) || Number(food?.day) !== day) {
    throw new LunchAdminError(409, "not_today", PAST_DAY_EDIT_MESSAGE);
  }

  // mirror: Student.food เหมือนเดิมทุกตัวอักษร
  await Student.updateOne({ _id: student._id }, { $set: { food } }, { session });

  const upsert = () =>
    FoodChoice.updateOne(
      { studentId: student._id, classId: classDoc._id, day },
      {
        $set: {
          dayYMD: classDayYMD(classDoc, day),
          ...pickFoodChoiceFields(food),
          source: source || foodChoiceSourceOf(actor),
          backfillFrom: "",
          updatedBy: actorLabelOf(actor),
        },
      },
      { upsert: true, session },
    );

  try {
    await upsert();
  } catch (err) {
    if (!isFoodChoiceKeyCollision(err)) throw err;
    if (!session) {
      await upsert();
    } else if (!retriedSessions.has(session)) {
      retriedSessions.add(session);
      if (typeof err.addErrorLabel === "function") err.addErrorLabel("TransientTransactionError");
      throw err;
    } else {
      throw err;
    }
  }

  return { day };
}
