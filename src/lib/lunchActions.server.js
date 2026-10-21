// src/lib/lunchActions.server.js
//
// R2a: ทางเดียวของการเปลี่ยน "ตัวเลือกอาหาร" (Student.food) คู่กับออเดอร์อาหารกลางวัน (LunchOrder)
//   - changeFoodChoice      : แท็บเล็ต / Food Report เปลี่ยนตัวเลือก (R-i)
//   - cancelCoupon          : แอดมินยกเลิกคูปอง -> ไม่รับอาหาร (R-e)
//   - cancelForEdit         : แอดมินยกเลิกเพื่อแก้ไข + ออก QR ใหม่ (R-f)
//   - regenerateLunchQr     : แอดมินออก QR ใหม่ให้ใบ pending (R-d)
//   - issueLunchQrForCoupon : แอดมินออก QR ให้คนที่เลือกคูปองแต่ยังไม่มีใบ (R-g)
//   - getLunchQr            : แอดมินดู QR ของใบที่ยังใช้งานได้ (R-h)
//   - wasPlacedToday        : "เคยสั่งแล้ว" ดูทุกใบของวันนั้น (R-c)
//
// กติกา:
//   - การเขียนทุกอย่างของ 1 action อยู่ใน transaction เดียว (withTransaction)
//   - audit / FoodEditLog เขียนหลัง commit เท่านั้น (best-effort เหมือนเดิม)
//   - ไม่ผ่านเงื่อนไข = throw LunchAdminError(status, reason, ข้อความไทย) แบบ lunchAdmin.server.js
//     route แปลงเป็น { error, reason } ด้วย lunchAdminErrorBody ตัวเดิม
//   - สำเร็จ = คืน { ok: true, ... } (มี qrUrl เมื่อมีใบใหม่ / ดู QR)

import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";
import FoodEditLog from "@/models/FoodEditLog";

import {
  LunchAdminError,
  cancelLunchOrder,
  writeLunchAudit,
  wasPlacedToday,
  assertCouponChoiceToday,
  afterFinalCloseMessage,
  ALREADY_USED_MESSAGE,
  ORDER_LOCKED_MESSAGE,
} from "@/lib/lunchAdmin.server";
import { issueLunchOrder, activeKeyOf, computeStatus } from "@/lib/lunchOrders.server";
import { couponUnavailableMessage } from "@/lib/couponAvailability.server";
import { toBkkYMD, finalCloseAt, reissueDeadline, isCouponClosed } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import { classDayIndexToday, isCheckinToday } from "@/lib/classDates";
import { writeAuditLog } from "@/lib/auditLog.server";
import { getBaseUrl } from "@/lib/baseUrl.server";
import {
  couponChoiceProblem,
  FOOD_CHOICE_MISMATCH_MESSAGE,
  FOOD_CHOICE_NOT_COUPON_MESSAGE,
} from "@/lib/lunchChoice";

export { wasPlacedToday };

/* ---------------- small helpers ---------------- */

function fail(status, reason, message, extra = null) {
  throw new LunchAdminError(status, reason, message, extra);
}

function clean(x) {
  return String(x || "").trim();
}

function uniqStrArr(a) {
  if (!Array.isArray(a)) return [];
  return [...new Set(a.map(String).map((s) => s.trim()).filter(Boolean))];
}

function isObjectId(x) {
  return mongoose.Types.ObjectId.isValid(String(x || ""));
}

function pickStudentName(st) {
  return clean(st?.name) || clean(st?.thaiName) || clean(st?.engName) || "ผู้เรียน";
}

/** ทุก write ของ action เดียวใน transaction เดียว */
async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

// issueLunchOrder ใน transaction ไม่อ่านใบผู้ชนะต่อ (ดู lunchOrders.server.js) -> E11000 = มีใบ live แล้ว
function isDuplicateKey(e) {
  return e?.code === 11000 || e?.cause?.code === 11000;
}

export const ALREADY_ACTIVE_MESSAGE = "ผู้เรียนมีออเดอร์ที่ยังใช้งานอยู่แล้ว";
export const LUNCH_CANCEL_FAILED_MESSAGE =
  "ยกเลิกออเดอร์คูปองเดิมไม่สำเร็จ ยังไม่ได้บันทึกการเปลี่ยนแปลง กรุณาลองใหม่";
const NO_COUPON_SHOP_MESSAGE = "ออก QR ใหม่ไม่ได้ (วันนี้ไม่มีร้านคูปองที่เปิดรับ)";

function rethrowIssueError(e) {
  if (isDuplicateKey(e)) fail(409, "already_active", ALREADY_ACTIVE_MESSAGE);
  throw e;
}

/** R-h: URL ของ QR จาก base URL ที่ตั้งไว้ (NEXT_PUBLIC_BASE_URL -> VERCEL_URL -> request) */
export function lunchQrUrl(token) {
  return `${getBaseUrl().replace(/\/+$/, "")}/lunch/${token}`;
}

/* ---------------- R-b: เงื่อนไขของ action แอดมินที่เปลี่ยนสถานะ ---------------- */

// วันนี้เท่านั้น (เวลาไทยตาม lunchNow) / ก่อนปิด 15:00 / ร้านยังไม่ได้ใช้คูปอง
// R2a-2: pure — ใช้ทั้งตอนทำรายการจริงและตอนคำนวณปุ่มของแต่ละแถว (null = ผ่าน)
export function actionWindowProblem(order, now) {
  if (String(order?.dayYMD || "") !== toBkkYMD(now)) {
    return { reason: "not_today", message: "ทำได้เฉพาะออเดอร์ของวันนี้เท่านั้น" };
  }
  const fc = finalCloseAt(order.dayYMD);
  if (fc && new Date(now).getTime() >= fc.getTime()) {
    return { reason: "after_final_close", message: afterFinalCloseMessage() };
  }
  if (order.redeemedAt) return { reason: "already_used", message: ALREADY_USED_MESSAGE };
  return null;
}

function assertActionWindow(order, now) {
  const p = actionWindowProblem(order, now);
  if (p) fail(409, p.reason, p.message);
}

async function loadOrder(orderId, session) {
  if (!isObjectId(orderId)) fail(400, "bad_request", "ข้อมูลไม่ครบ");
  const order = await LunchOrder.findById(orderId).session(session).lean();
  if (!order) fail(404, "not_found", "ไม่พบออเดอร์");
  return order;
}

/* ---------------- food choice logs (ย้ายมาจาก api/checkin/food) ---------------- */

function normalizeFoodSnapshot(food) {
  const f = food || {};
  return JSON.stringify({
    noFood: !!f.noFood,
    choiceType: clean(f.choiceType),
    classId: clean(f.classId),
    day: Number.isFinite(Number(f.day)) ? Number(f.day) : null,
    restaurantId: clean(f.restaurantId),
    menuId: clean(f.menuId),
    addonIds: uniqStrArr(f.addonIds).sort(),
    drinkId: clean(f.drinkId),
    note: clean(f.note),
  });
}

function pickFoodAudit(food) {
  const f = food || {};
  return {
    noFood: !!f.noFood,
    choiceType: clean(f.choiceType),
    classId: clean(f.classId),
    day: Number.isFinite(Number(f.day)) ? Number(f.day) : null,
    restaurantId: clean(f.restaurantId),
    menuId: clean(f.menuId),
    addonIds: uniqStrArr(f.addonIds).sort(),
    drinkId: clean(f.drinkId),
    note: clean(f.note),
  };
}

async function writeFoodEditLog({ student, nextFood, prevFood, source = "" }) {
  try {
    if (normalizeFoodSnapshot(prevFood) === normalizeFoodSnapshot(nextFood)) return;
    await FoodEditLog.create({
      studentId: String(student?._id || ""),
      classId: clean(nextFood?.classId),
      day: Number.isFinite(Number(nextFood?.day)) ? Number(nextFood.day) : null,
      choiceType: clean(nextFood?.choiceType),
      restaurantId: clean(nextFood?.restaurantId),
      menuId: clean(nextFood?.menuId),
      addonIds: uniqStrArr(nextFood?.addonIds),
      drinkId: clean(nextFood?.drinkId),
      note: clean(nextFood?.note),
      studentName: pickStudentName(student),
      studentCompany: clean(student?.company),
      source: clean(source),
    });
  } catch (e) {
    console.warn("[lunchActions] writeFoodEditLog failed:", e?.message || e);
  }
}

async function writeFoodAuditLog({ ctx, req, student, nextFood, prevFood, source = "" }) {
  try {
    if (normalizeFoodSnapshot(prevFood) === normalizeFoodSnapshot(nextFood)) return;
    const sid = String(student?._id || "");
    const cid = clean(nextFood?.classId);
    const day = Number.isFinite(Number(nextFood?.day)) ? Number(nextFood?.day) : null;
    await writeAuditLog({
      ctx: ctx || {},
      req,
      action: "update",
      entityType: "food",
      entityId: `${sid}__${cid || "noClass"}__day${day || 0}`,
      entityLabel: `${pickStudentName(student)} • food day ${day || "-"}`.trim(),
      before: pickFoodAudit(prevFood),
      after: pickFoodAudit(nextFood),
      meta: {
        studentId: sid,
        classId: cid,
        day,
        source: clean(source),
        ...(ctx?.kiosk ? { kiosk: ctx.kiosk } : {}),
      },
      ignorePaths: [],
    });
  } catch (e) {
    console.warn("[lunchActions] writeFoodAuditLog failed:", e?.message || e);
  }
}

async function writeFoodLogs(args) {
  await writeFoodEditLog(args);
  await writeFoodAuditLog(args);
}

/** Student.food ของ "ไม่รับอาหาร" — รูปเดียวกับที่ /api/checkin/food บันทึก */
export function noFoodChoice({ classId, day }) {
  return {
    noFood: true,
    coupon: false,
    choiceType: "noFood",
    classId: String(classId || ""),
    day: Number.isFinite(Number(day)) ? Number(day) : undefined,
    restaurantId: "",
    menuId: "",
    addonIds: [],
    drinkId: "",
    addons: [],
    drink: "",
    // R2b: ไม่เขียนโน้ตอัตโนมัติ — ตัวเลือกดูจาก choiceType
    note: "",
  };
}

/* ---------------- R-i: เปลี่ยนตัวเลือกอาหาร ---------------- */

/**
 * บันทึก Student.food ใหม่ และ (ถ้าเปลี่ยนจากคูปองไปอย่างอื่น) ยกเลิกใบ pending ของวันนี้
 * ใน transaction เดียว — ยกเลิกไม่ได้ = ไม่บันทึกตัวเลือกใหม่
 *   ordered / at_shop -> 409 order_locked (ต้องให้เจ้าหน้าที่จัดการ)
 *   ยกเลิก throw      -> 500 lunch_cancel_failed
 * student = เอกสาร Student (ต้องมี _id, ใช้ชื่อ/บริษัทลง log)
 */
export async function changeFoodChoice({
  student,
  classId,
  nextFood,
  prevFood,
  ctx = null,
  req = null,
  source = "",
  now,
}) {
  const at = now ? new Date(now) : lunchNow();
  const studentId = String(student?._id || "");
  if (!studentId) fail(400, "bad_request", "ข้อมูลไม่ครบ");

  const movingAway = prevFood?.choiceType === "coupon" && nextFood?.choiceType !== "coupon";
  const dayYMD = toBkkYMD(at);
  let cancel = null;

  await inTransaction(async (session) => {
    cancel = null;

    if (movingAway && classId) {
      const live = await LunchOrder.findOne({
        activeKey: activeKeyOf(String(classId), studentId, dayYMD),
      })
        .session(session)
        .lean();

      if (live && (live.status === "ordered" || live.status === "at_shop")) {
        fail(409, "order_locked", ORDER_LOCKED_MESSAGE);
      }
      if (live && live.status === "pending") {
        try {
          cancel = await cancelLunchOrder({
            orderId: live._id,
            reason: "choice_changed",
            cancelledBy: "learner",
            auditAction: "lunch.cancel_choice_changed",
            ctx,
            req,
            now: at,
            session,
          });
        } catch (e) {
          // ให้ withTransaction retry เองถ้าเป็นข้อผิดพลาดชั่วคราว
          if (e?.hasErrorLabel?.("TransientTransactionError")) throw e;
          console.warn("[lunchActions] choice_changed cancel failed:", e?.message || e);
          fail(500, "lunch_cancel_failed", LUNCH_CANCEL_FAILED_MESSAGE);
        }
      }
    }

    await Student.updateOne({ _id: student._id }, { $set: { food: nextFood } }, { session });
  });

  if (cancel) await cancel.afterCommit();
  await writeFoodLogs({ ctx, req, student, nextFood, prevFood, source });

  return {
    ok: true,
    choiceType: nextFood?.choiceType || "",
    cancelledOrderId: cancel?.orderId || null,
  };
}

/* ---------------- R-e: ยกเลิกคูปอง -> ไม่รับอาหาร ---------------- */

export async function cancelCoupon({ orderId, adminId = null, ctx = null, req = null, now }) {
  const at = now ? new Date(now) : lunchNow();
  let cancel = null;
  let student = null;
  let prevFood = null;
  let nextFood = null;

  await inTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    if (!["pending", "ordered", "at_shop"].includes(order.status)) {
      fail(409, "not_cancellable", "ออเดอร์นี้ถูกยกเลิกไปแล้ว");
    }
    assertActionWindow(order, at);

    student = await Student.findById(order.studentId).session(session).lean();
    if (!student) fail(404, "student_not_found", "ไม่พบผู้เรียน");

    const klass = await Class.findById(order.classId)
      .select("date days dayCount duration.dayCount")
      .session(session)
      .lean();
    const f = student.food || {};

    // ตัวเลือกอาหารที่เก็บไว้ต้องเป็นคูปองของคลาสนี้ / วันนี้ — ไม่ใช่ = ไม่เดา
    const problem = couponChoiceProblem(f, klass, order.classId, order.dayYMD, { strict: true });
    if (problem) fail(409, problem.reason, problem.message);
    const dayIndex = classDayIndexToday(klass, at);

    prevFood = f;
    nextFood = noFoodChoice({ classId: order.classId, day: dayIndex });

    cancel = await cancelLunchOrder({
      orderId: order._id,
      adminId,
      reason: "admin_cancel_coupon",
      auditAction: "lunch.cancel_coupon",
      ctx,
      req,
      now: at,
      session,
    });
    await Student.updateOne({ _id: student._id }, { $set: { food: nextFood } }, { session });
  });

  await cancel.afterCommit({ foodChoiceAfter: "noFood" });
  await writeFoodLogs({ ctx, req, student, nextFood, prevFood, source: "admin-lunch" });

  return {
    ok: true,
    orderId: cancel.orderId,
    statusBefore: cancel.statusBefore,
    couponEffect: cancel.couponEffect,
    choiceType: "noFood",
  };
}

/* ---------------- ยกเลิกใบเดิม + ออกใบใหม่ (R-f / R-d) ---------------- */

async function cancelAndReissue({
  orderId,
  allowedStatuses,
  notAllowedMessage,
  reason,
  auditAction,
  deadlineOf,
  reopenCountOf,
  adminId,
  ctx,
  req,
  at,
  extraCheck = null,
}) {
  let cancel = null;
  let newOrder = null;

  try {
    await inTransaction(async (session) => {
      const order = await loadOrder(orderId, session);
      if (!allowedStatuses.includes(order.status)) {
        fail(409, "not_allowed_status", notAllowedMessage);
      }
      assertActionWindow(order, at);
      if (extraCheck) extraCheck(order);

      cancel = await cancelLunchOrder({
        orderId: order._id,
        adminId,
        reason,
        auditAction,
        ctx,
        req,
        now: at,
        session,
      });

      const res = await issueLunchOrder({
        studentId: order.studentId,
        classId: order.classId,
        dayYMD: order.dayYMD,
        now: at,
        deadlineAt: deadlineOf(order),
        reopenCount: reopenCountOf(order),
        session,
      });
      if (!res.ok) fail(409, res.reason || "issue_failed", NO_COUPON_SHOP_MESSAGE);
      if (!res.created) fail(409, "already_active", ALREADY_ACTIVE_MESSAGE);
      newOrder = res.order;
    });
  } catch (e) {
    rethrowIssueError(e);
  }

  await cancel.afterCommit({
    newOrderId: String(newOrder._id),
    newDeadlineAt: newOrder.deadlineAt,
  });

  return {
    ok: true,
    orderId: cancel.orderId,
    statusBefore: cancel.statusBefore,
    couponEffect: cancel.couponEffect,
    newOrderId: String(newOrder._id),
    deadlineAt: newOrder.deadlineAt,
    reopenCount: newOrder.reopenCount || 0,
    holderName: newOrder.holderName || "",
    path: `/lunch/${newOrder.token}`,
    qrUrl: lunchQrUrl(newOrder.token),
  };
}

/**
 * R-f: ยกเลิกเพื่อแก้ไข (ordered / at_shop) — ตัวเลือกอาหารยังเป็นคูปอง
 * ใบใหม่ได้เส้นตาย C1 = min(max(11:15, now + 10 นาที), 15:00)
 */
export async function cancelForEdit({ orderId, adminId = null, ctx = null, req = null, now }) {
  const at = now ? new Date(now) : lunchNow();
  return cancelAndReissue({
    orderId,
    allowedStatuses: ["ordered", "at_shop"],
    notAllowedMessage: "ยกเลิกเพื่อแก้ไขได้เฉพาะออเดอร์ที่สั่งแล้ว",
    reason: "admin_cancel_for_edit",
    auditAction: "lunch.cancel_for_edit",
    deadlineOf: (order) => reissueDeadline(order.dayYMD, at),
    reopenCountOf: (order) => (order.reopenCount || 0) + 1,
    adminId,
    ctx,
    req,
    at,
  });
}

/**
 * R-d: ออก QR ใหม่ให้ใบ pending — ยกเลิกใบเดิม (qr_regenerated) แล้วออกใบใหม่
 * deadlineAt คัดลอกจากใบเดิม (ไม่ยืดเวลา) และไม่หมุน token ในใบเดิม
 */
export async function regenerateLunchQr({ orderId, adminId = null, ctx = null, req = null, now }) {
  const at = now ? new Date(now) : lunchNow();
  return cancelAndReissue({
    orderId,
    allowedStatuses: ["pending"],
    notAllowedMessage: "ออก QR ใหม่ได้เฉพาะผู้เรียนที่ยังไม่ได้สั่ง",
    reason: "qr_regenerated",
    auditAction: "lunch.regenerate",
    // คัดลอกเส้นตายเดิม — ไม่มีค่า (ข้อมูลเก่า) = issueLunchOrder ใช้เส้นตายปกติของวันนั้น
    deadlineOf: (order) => order.deadlineAt || undefined,
    reopenCountOf: (order) => order.reopenCount || 0,
    adminId,
    ctx,
    req,
    at,
    extraCheck: (order) => {
      if (order.submittedAt) fail(409, "not_allowed_status", "ออเดอร์นี้สั่งไปแล้ว");
    },
  });
}

/* ---------------- R-g: ออก QR (กติกาเดียวกับแท็บเล็ต) ---------------- */

/** ข้อความไทยของเหตุผลที่ออก QR ไม่ได้ (ใช้ทั้งแท็บเล็ตและแอดมิน) */
export function issueReasonMessage(reason) {
  if (
    reason === "class_disabled" ||
    reason === "no_coupon_restaurant" ||
    reason === "coupon_closed"
  ) {
    return couponUnavailableMessage(reason);
  }
  if (reason === "not_checked_in") return "ยังไม่พบการเช็คอินของวันนี้";
  if (reason === "not_coupon_choice") return "วันนี้ไม่ได้เลือกรับคูปอง";
  if (reason === "coupon_not_today") return "ตัวเลือกคูปองที่บันทึกไว้ไม่ใช่ของวันนี้";
  if (reason === "not_class_day") return "วันนี้ไม่ใช่วันเรียนของคลาสนี้";
  if (reason === "student_not_in_class") return "ผู้เรียนไม่ได้อยู่ในคลาสนี้";
  if (reason === "student_not_found") return "ไม่พบผู้เรียน";
  if (reason === "class_not_found") return "ไม่พบคลาส";
  return "ออก QR ไม่สำเร็จ";
}

/**
 * กติกาออก QR ของ /api/checkin/lunch-token (ย้ายมาไว้ที่เดียว ใช้ทั้งแท็บเล็ตและแอดมิน)
 * server ต้องพิสูจน์เองทุกข้อ:
 *   - นักเรียนคนนี้อยู่คลาสนี้จริง
 *   - วันนี้เป็นวันเรียน และเช็คอินแล้วจริง
 *   - ตัวเลือกอาหารที่บันทึกไว้ของวันนี้คือ "coupon"
 *   - ยังไม่ถึง 15:00
 * คืน { ok: true, todayYMD, dayIndex } หรือ { ok: false, reason, status }
 */
export async function assertLunchIssueAllowed({ classId, studentId }) {
  const no = (reason, status) => ({ ok: false, reason, status });

  if (!isObjectId(classId) || !isObjectId(studentId)) return no("bad_request", 400);

  const [student, klass] = await Promise.all([
    Student.findById(studentId).select("classId food").lean(),
    Class.findById(classId).select("date days dayCount duration.dayCount").lean(),
  ]);

  if (!student) return no("student_not_found", 404);
  if (!klass) return no("class_not_found", 404);

  // 1) ผู้เรียนต้องอยู่คลาสนี้จริง
  if (String(student.classId || "") !== String(classId)) {
    return no("student_not_in_class", 403);
  }

  const todayYMD = toBkkYMD(new Date());

  // 2) ต้องเช็คอินแล้ววันนี้ — ดูจาก Checkin ของวันเรียนที่ตรงกับวันนี้
  //    P3g: วันเรียนของวันนี้มาจาก helper กลาง (เวลาไทย, days[] ก่อน)
  const dayIndex = classDayIndexToday(klass) || 0;
  if (dayIndex < 1) return no("not_class_day", 409);

  // L2b: "เช็คอินแล้ววันนี้" = มี Checkin ของ (ผู้เรียน, คลาส, day ของวันนี้)
  //      และ isCheckinToday (เวลาเช็คอินตกวันนี้ตามเวลาไทย)
  const checkin = await Checkin.findOne({
    studentId: student._id,
    classId: klass._id,
    day: dayIndex,
  }).lean();
  if (!isCheckinToday(checkin)) return no("not_checked_in", 403);

  // 3a) ไม่ได้เลือกคูปองเลย = ไม่มี Step 3 (ไม่ใช่ความผิดพลาด)
  const food = student.food || {};
  if (String(food.choiceType || "") !== "coupon") return no("not_coupon_choice", 409);

  // 3b) คูปองที่เลือกไว้ต้องเป็นของคลาสนี้ และของ "วันนี้"
  const foodClassMatches = !food.classId || String(food.classId) === String(classId);
  const foodDayMatches =
    food.day === null || food.day === undefined ? false : Number(food.day) === dayIndex;
  if (!foodClassMatches || !foodDayMatches) return no("coupon_not_today", 409);

  // C2: ถึง 15:00 แล้ว ไม่ออก QR
  const now = lunchNow();
  if (isCouponClosed(toBkkYMD(now), now)) return no("coupon_closed", 403);

  return { ok: true, todayYMD, dayIndex };
}

/**
 * R-g: แอดมินออก QR ให้ผู้เรียนที่เลือกคูปอง (เช่นเปลี่ยนกลับมาเป็นคูปอง) และยังไม่มีใบ live
 *   - กติกาเดียวกับแท็บเล็ต (assertLunchIssueAllowed) + เส้นตายปกติ (ไม่ยืด)
 *   - เคยสั่งแล้ว (R-c) และใบล่าสุดถูกยกเลิกเพื่อแก้ไข -> ใช้เส้นตายแบบ reopen (C1)
 */
export async function issueLunchQrForCoupon({ classId, studentId, ctx = null, req = null }) {
  if (!isObjectId(classId) || !isObjectId(studentId)) fail(400, "bad_request", "ข้อมูลไม่ครบ");
  // R2a-2: ตัวเลือกปัจจุบันของคลาส/วันนี้ต้องเป็นคูปอง (reason food_choice_not_coupon)
  //        วันเดียวกับที่ assertLunchIssueAllowed ใช้ (toBkkYMD(new Date()) แบบแท็บเล็ต)
  await assertCouponChoiceToday({ classId, studentId, dayYMD: toBkkYMD(new Date()) });

  const guard = await assertLunchIssueAllowed({ classId, studentId });
  if (!guard.ok) fail(guard.status, guard.reason, issueReasonMessage(guard.reason));

  const at = lunchNow();
  const dayYMD = guard.todayYMD;
  let order = null;
  let reopenPath = false;

  try {
    await inTransaction(async (session) => {
      const live = await LunchOrder.findOne({
        activeKey: activeKeyOf(String(classId), String(studentId), dayYMD),
      })
        .session(session)
        .lean();
      if (live) fail(409, "already_active", ALREADY_ACTIVE_MESSAGE);

      const latest = await LunchOrder.findOne({ classId, studentId, dayYMD })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();
      const placed = await wasPlacedToday({ classId, studentId, dayYMD, session });
      reopenPath = placed && latest?.status === "cancelled" && isEditCancel(latest);

      const res = await issueLunchOrder({
        studentId,
        classId,
        dayYMD,
        now: at,
        ...(reopenPath
          ? {
              deadlineAt: reissueDeadline(dayYMD, at),
              reopenCount: (latest?.reopenCount || 0) + 1,
            }
          : {}),
        session,
      });
      if (!res.ok) fail(409, res.reason || "issue_failed", issueReasonMessage(res.reason));
      if (!res.created) fail(409, "already_active", ALREADY_ACTIVE_MESSAGE);
      order = res.order;
    });
  } catch (e) {
    rethrowIssueError(e);
  }

  await writeLunchAudit({
    ctx,
    req,
    action: reopenPath ? "lunch.reopen" : "lunch.issue",
    order,
    before: { status: "none" },
    after: { status: "pending", deadlineAt: order.deadlineAt },
    meta: {
      statusBefore: "none",
      statusAfter: "pending",
      source: "admin",
      reopenPath,
      reopenCount: order.reopenCount || 0,
    },
  });

  return {
    ok: true,
    orderId: String(order._id),
    deadlineAt: order.deadlineAt,
    reopenCount: order.reopenCount || 0,
    holderName: order.holderName || "",
    path: `/lunch/${order.token}`,
    qrUrl: lunchQrUrl(order.token),
  };
}

/* ---------------- R-h: ดู QR ---------------- */

/**
 * QR ของใบที่ยังมี token ใช้งานได้ (pending / ordered / at_shop / forfeited)
 * ใบที่ยกเลิกแล้ว = no_active_qr · เขียน audit ทุกครั้งที่เปิดดู
 */
export async function getLunchQr({ orderId, ctx = null, req = null }) {
  const order = await loadOrder(orderId, null);
  if (order.status === "cancelled" || !order.activeKey || !order.token) {
    fail(409, "no_active_qr", "ไม่มี QR ที่ใช้งานได้ (ออเดอร์นี้ถูกยกเลิกแล้ว)");
  }

  const status = computeStatus(order, lunchNow());

  await writeLunchAudit({
    ctx,
    req,
    action: "lunch.view_qr",
    order,
    meta: { statusBefore: status, statusAfter: status },
  });

  return {
    ok: true,
    orderId: String(order._id),
    status,
    deadlineAt: order.deadlineAt || null,
    holderName: order.holderName || "",
    path: `/lunch/${order.token}`,
    qrUrl: lunchQrUrl(order.token),
  };
}

/* ---------------- R2a-2: ปุ่มของแต่ละแถว (pure — ที่เดียวที่ตัดสินว่าแสดง/กดได้ไหม) ---------------- */

const ALLOW = Object.freeze({ allowed: true, reason: null });
const deny = (message) => ({ allowed: false, reason: message || "ทำรายการนี้ไม่ได้" });
const fromProblem = (p) => (p ? deny(p.message) : ALLOW);

/**
 * ใบที่ถูกยกเลิกเพื่อแก้ไขออเดอร์ (ออก QR ใหม่ใช้เส้นตายแบบ reopen)
 * ก่อน R2a ปุ่ม "ยกเลิก" ของแอดมินคือขั้นแรกของ "เปลี่ยนร้าน/เมนู" — cancelReason ว่าง + ยกเลิกโดยแอดมิน
 */
export function isEditCancel(order) {
  const r = String(order?.cancelReason || "");
  if (r === "admin_cancel_for_edit") return true;
  return r === "" && !!order?.cancelledBy && order.cancelledBy !== "learner";
}

// ตัวเลือกปัจจุบัน (ของคลาส/วันของแถว) ต้องเป็นคูปอง — ข้อความเดียวกับ couponChoiceProblem
function choiceProblemOf(currentChoice, strict) {
  if (!currentChoice) {
    return { message: strict ? FOOD_CHOICE_MISMATCH_MESSAGE : FOOD_CHOICE_NOT_COUPON_MESSAGE };
  }
  if (currentChoice.choiceType !== "coupon") return { message: FOOD_CHOICE_NOT_COUPON_MESSAGE };
  return null;
}

/**
 * ปุ่มของแถว (ใบล่าสุดของผู้เรียนคนนั้นในวันนั้น)
 *   คืน { viewQr, regenerate, cancelCoupon, cancelForEdit, issue, handout, return }
 *   แต่ละตัว = { allowed, reason } · ไม่เกี่ยวกับสถานะนั้น = ไม่มี key
 * เงื่อนไขเดียวกับฟังก์ชันจริงด้านบน (server ตรวจซ้ำอีกครั้งตอนกด)
 *   status        : computeStatus ของใบ (pending / forfeited / ordered / at_shop / cancelled)
 *   stockStatus   : สถานะรหัส stock ของใบ ("" = ไม่มี)
 *   currentChoice : { choiceType, restaurantName } ของคลาส/วันของแถว — ไม่ตรงวัน = null
 */
export function rowActions({ order, status, stockStatus = "", currentChoice = null, now }) {
  const a = {};
  const live = order?.status !== "cancelled" && !!order?.activeKey && !!order?.token;
  const win = actionWindowProblem(order, now);

  if (["pending", "forfeited", "ordered", "at_shop"].includes(status)) {
    a.viewQr = live ? ALLOW : deny("ไม่มี QR ที่ใช้งานได้");
  }

  if (status === "pending") {
    a.regenerate = fromProblem(
      win || (order.submittedAt ? { message: "ออเดอร์นี้สั่งไปแล้ว" } : null),
    );
    a.cancelCoupon = fromProblem(win || choiceProblemOf(currentChoice, true));
  }

  if (status === "ordered" || status === "at_shop") {
    a.cancelForEdit = fromProblem(win);
    a.cancelCoupon = fromProblem(win || choiceProblemOf(currentChoice, true));
    // กติกาเดิม: ร้าน stock + รหัสยัง assigned
    if (stockStatus === "assigned") a.handout = ALLOW;
  }

  if (status === "cancelled") {
    // แสดงเฉพาะเมื่อตัวเลือกปัจจุบันของคลาส/วันนั้นเป็นคูปอง
    // (ยกเลิกเพื่อแก้ไข / เปลี่ยนกลับมาเป็นคูปอง) — เปลี่ยนเป็น Set / ไม่รับอาหาร = ไม่เสนอเลย
    if (currentChoice?.choiceType === "coupon") a.issue = fromProblem(win);
    // กติกาเดิม: รหัส stock รอรับคืน
    if (stockStatus === "awaiting_return") a.return = ALLOW;
  }

  return a;
}
