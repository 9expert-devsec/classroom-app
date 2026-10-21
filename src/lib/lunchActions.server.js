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
//   - reassignLunchCoupon   : R3 แอดมินโยกผู้เรียน (คูปอง) ไปร้านอื่น ทั้งชุดใน transaction เดียว
//   - previewLunchReassign  : R3 ตรวจสิทธิ์ทีละคน + ความจุร้านปลายทาง (อ่านอย่างเดียว)
//
// กติกา:
//   - การเขียนทุกอย่างของ 1 action อยู่ใน transaction เดียว (withTransaction)
//   - audit / FoodEditLog เขียนหลัง commit เท่านั้น (best-effort เหมือนเดิม)
//   - ไม่ผ่านเงื่อนไข = throw LunchAdminError(status, reason, ข้อความไทย) แบบ lunchAdmin.server.js
//     route แปลงเป็น { error, reason } ด้วย lunchAdminErrorBody ตัวเดิม
//   - สำเร็จ = คืน { ok: true, ... } (มี qrUrl เมื่อมีใบใหม่ / ดู QR)

import crypto from "node:crypto";
import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";
import FoodEditLog from "@/models/FoodEditLog";
import Restaurant from "@/models/Restaurant";

import {
  LunchAdminError,
  cancelLunchOrder,
  writeLunchAudit,
  wasPlacedToday,
  assertCouponChoiceToday,
  afterFinalCloseMessage,
  adminDisplayName,
  ALREADY_USED_MESSAGE,
  ORDER_LOCKED_MESSAGE,
} from "@/lib/lunchAdmin.server";
import { issueLunchOrder, activeKeyOf, computeStatus } from "@/lib/lunchOrders.server";
import { couponUnavailableMessage, getDaySet } from "@/lib/couponAvailability.server";
import { assignCode, countAvailable } from "@/lib/couponStock.server";
import { generateECouponCode } from "@/lib/lunchSubmit.server";
import { withCouponCodeRetry } from "@/lib/couponCodeRetry.server";
import {
  toBkkYMD,
  finalCloseAt,
  reissueDeadline,
  isCouponClosed,
  finalCloseLabel,
  LUNCH_BUDGET_THB,
} from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import { classDayIndexToday, isCheckinToday, isYMD } from "@/lib/classDates";
import { writeAuditLog } from "@/lib/auditLog.server";
import { getBaseUrl } from "@/lib/baseUrl.server";
import {
  couponChoiceProblem,
  todayFoodOf,
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

  // R4L-4: "ย้ายออกจากคูปอง" นับเฉพาะเมื่อตัวเลือกเดิมเป็นคูปองของ "วันนี้" ของคลาสนี้ (todayFoodOf)
  //         คูปองของวันก่อนไม่ใช่คูปองวันนี้ -> ไม่แตะออเดอร์ใด ๆ · คูปองวันนี้จริงยกเลิกเหมือนเดิม
  let movingAway = false;
  if (prevFood?.choiceType === "coupon" && nextFood?.choiceType !== "coupon" && isObjectId(classId)) {
    const klass = await Class.findById(classId)
      .select("date days dayCount duration.dayCount")
      .lean();
    movingAway = todayFoodOf({ food: prevFood }, klass, at)?.choiceType === "coupon";
  }
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

  // 3) R4L-4: ตัวเลือกต้องเป็นคูปองของ "วันนี้" ของคลาสนี้ (todayFoodOf — classId / day ว่าง = ไม่ตรง)
  //    3a) ไม่ได้เลือกคูปองเลย = ไม่มี Step 3 (ไม่ใช่ความผิดพลาด)
  //    3b) เลือกคูปองไว้ แต่ไม่ใช่ของคลาสนี้ / ของวันนี้ = coupon_not_today
  const food = student.food || {};
  const todayFood = todayFoodOf(student, klass);
  if (!todayFood) {
    return no(String(food.choiceType || "") === "coupon" ? "coupon_not_today" : "not_coupon_choice", 409);
  }
  if (String(todayFood.choiceType || "") !== "coupon") return no("not_coupon_choice", 409);

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

/* ---------------- R3: โยกไปร้านอื่น (reassign) ---------------- */

// กติกา (ตรวจซ้ำใน transaction ทุกครั้ง):
//   ทั้งชุด : วันนี้เท่านั้น / ก่อนเวลาปิด (finalCloseAt — เวลาทดสอบใช้ได้)
//   ร้านปลายทาง : อยู่ใน Food Calendar ของวันนั้นแบบ coupon (ไม่ใช่ closed) + ร้านเปิดใช้งาน + couponEnabled
//               ร้าน stock ที่ไม่มี fallback และคูปองกระดาษไม่พอทั้งชุด -> ไม่โยกใครเลย
//   ผู้เรียน : ตัวเลือกปัจจุบันของคลาส/วันนี้เป็นคูปอง + คลาสไม่ได้ปิดคูปอง + มีใบ live
//             (pending / ordered / at_shop) + ร้านยังไม่ได้ใช้คูปอง + ร้านปัจจุบันไม่ใช่ร้านปลายทาง
// ผล (ต่อคน):
//   ordered / at_shop : ยกเลิกใบเดิมด้วย cancelLunchOrder (reason "reassigned" — คูปองเดิมตามกติกาเดิม:
//                       กระดาษยังไม่ส่งมอบคืนคลัง / ส่งมอบแล้วรอคืน / e-coupon void) แล้วออกใบใหม่
//   pending           : ยังไม่มีออเดอร์ให้ยกเลิก — ใบ pending กลายเป็นใบของร้านปลายทางเลย (QR เดิมพาไปคูปองใหม่)
//   ใบของร้านปลายทาง = at_shop ไม่มีรายการอาหาร งบ 180 + คูปองแบบเดียวกับ lunchSubmit
//   (ร้าน stock: กระดาษก่อน ขาดเท่าไรร้านที่ตั้ง fallback ออก e-coupon แทน · ร้านอื่น: e-coupon)

const REASSIGN_MAX = 200;
const REASSIGN_STATUSES = ["pending", "ordered", "at_shop"];
const REASSIGN_ECOUPON_ATTEMPTS = 8;
const REASSIGN_CONFLICT_MESSAGE = "ข้อมูลเพิ่งเปลี่ยน ยังไม่ได้โยกใคร กรุณาลองใหม่";

const SHOP_REASON_LABELS = {
  closed: "ร้านปิดวันนี้ (Food Calendar)",
  inactive: "ร้านถูกปิดใช้งาน",
  coupon_disabled: "ร้านไม่ได้เปิดใช้ระบบคูปอง",
  stock_out: "คูปองกระดาษหมด",
};

function normalizeReassignLearners(learners) {
  if (!Array.isArray(learners) || learners.length < 1) {
    fail(400, "bad_request", "กรุณาเลือกผู้เรียน");
  }
  if (learners.length > REASSIGN_MAX) {
    fail(400, "too_many", `โยกได้ครั้งละไม่เกิน ${REASSIGN_MAX} คน`);
  }
  const byKey = new Map();
  for (const l of learners) {
    const studentId = clean(l?.studentId);
    const classId = clean(l?.classId);
    if (!isObjectId(studentId) || !isObjectId(classId)) {
      fail(400, "bad_request", "ข้อมูลผู้เรียนไม่ครบ");
    }
    byKey.set(`${classId}:${studentId}`, { studentId, classId });
  }
  return [...byKey.values()];
}

// ปัญหาระดับทั้งชุด (วัน / เวลาปิด) — null = ผ่าน
function reassignWindowProblem(dayYMD, at) {
  if (dayYMD !== toBkkYMD(at)) {
    return { reason: "not_today", message: "โยกร้านได้เฉพาะวันนี้เท่านั้น" };
  }
  const fc = finalCloseAt(dayYMD);
  if (fc && at.getTime() >= fc.getTime()) {
    return { reason: "after_final_close", message: `หลัง ${finalCloseLabel()} น. โยกร้านไม่ได้` };
  }
  return null;
}

/**
 * ร้านคูปองของวันนั้นจาก Food Calendar (mode coupon / closed) พร้อมสถานะที่ใช้เป็นร้านปลายทางได้ไหม
 * stockAvailable = จำนวนกระดาษที่ยังไม่หมดอายุ (null = ร้าน e-coupon)
 */
async function reassignShops(dayYMD, session = null) {
  const daySet = await getDaySet(dayYMD);
  const modeById = new Map();
  for (const e of daySet?.entries || []) {
    if (e?.restaurant && (e.mode === "coupon" || e.mode === "closed")) {
      modeById.set(String(e.restaurant), e.mode);
    }
  }
  if (!modeById.size) return [];

  const docs = await Restaurant.find({ _id: { $in: [...modeById.keys()] } })
    .select("name isActive couponEnabled usesCouponStock stockFallbackToECoupon")
    .session(session)
    .lean();

  const out = [];
  for (const r of docs) {
    const id = String(r._id);
    const usesCouponStock = !!r.usesCouponStock;
    const stockFallback = usesCouponStock && !!r.stockFallbackToECoupon;
    const stockAvailable = usesCouponStock ? await countAvailable(r._id, dayYMD) : null;

    let reason = null;
    if (modeById.get(id) === "closed") reason = "closed";
    else if (r.isActive === false) reason = "inactive";
    else if (!r.couponEnabled) reason = "coupon_disabled";
    else if (usesCouponStock && !stockFallback && stockAvailable <= 0) reason = "stock_out";

    out.push({
      id,
      name: r.name || "",
      usesCouponStock,
      stockFallback,
      stockAvailable,
      available: !reason,
      reason,
      reasonLabel: reason ? SHOP_REASON_LABELS[reason] : "",
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** ความจุของร้านปลายทางสำหรับ needed คน (กระดาษก่อน ขาดเท่าไร fallback ออก e-coupon) */
function reassignCapacity(shop, needed) {
  if (!shop) return null;
  const paper = shop.usesCouponStock ? Math.min(shop.stockAvailable || 0, needed) : 0;
  const generated = shop.usesCouponStock ? (shop.stockFallback ? needed - paper : 0) : needed;
  const enough =
    shop.available && (!shop.usesCouponStock || shop.stockFallback || shop.stockAvailable >= needed);
  return { ...shop, needed, paper, generated, enough };
}

function stockShortMessage(shop, needed) {
  return `คูปองกระดาษของร้าน ${shop.name} ไม่พอ (ต้องการ ${needed} ใบ เหลือ ${shop.stockAvailable || 0} ใบ) — ยังไม่ได้โยกใคร`;
}

/**
 * ตรวจผู้เรียน 1 คน (อ่านอย่างเดียว) — คืน { eligible, reason, message, ... , live }
 * อ่านทีละ query (ไม่ Promise.all) เพราะ session เดียวใน transaction ห้ามยิงขนานกัน
 */
async function evaluateReassignLearner({ learner, dayYMD, at, targetId, session = null }) {
  const { studentId, classId } = learner;
  const out = {
    studentId,
    classId,
    eligible: false,
    reason: null,
    message: "",
    name: "",
    nickname: "",
    status: "",
    fromRestaurantId: "",
    fromRestaurantName: "",
    couponCode: "",
    live: null,
  };
  const no = (reason, message) => ({ ...out, reason, message });

  const student = await Student.findById(studentId)
    .select("name thaiName engName food")
    .session(session)
    .lean();
  if (!student) return no("student_not_found", "ไม่พบผู้เรียน");
  out.name = pickStudentName(student);

  const klass = await Class.findById(classId)
    .select("date days dayCount duration.dayCount disableCoupon")
    .session(session)
    .lean();
  if (!klass) return no("class_not_found", "ไม่พบคลาส");
  if (klass.disableCoupon) return no("class_disabled", couponUnavailableMessage("class_disabled"));
  if (!classDayIndexToday(klass, at)) return no("not_class_day", "วันนี้ไม่ใช่วันเรียนของคลาสนี้");

  const live = await LunchOrder.findOne({ activeKey: activeKeyOf(classId, studentId, dayYMD) })
    .session(session)
    .lean();
  if (live) {
    out.name = live.holderName || out.name;
    out.nickname = live.nickname || "";
    out.status = live.status;
    out.fromRestaurantId = live.restaurantId ? String(live.restaurantId) : "";
    out.fromRestaurantName = live.restaurantName || "";
    out.couponCode = live.couponCode || "";
  }

  // ตัวเลือกปัจจุบันของคลาส/วันนี้ต้องเป็นคูปอง (Set / ไม่รับอาหาร = ไม่เกี่ยว)
  if (couponChoiceProblem(student.food, klass, classId, dayYMD)) {
    return no("food_choice_not_coupon", "ตัวเลือกอาหารไม่ใช่คูปอง (Set / ไม่รับอาหาร)");
  }
  if (!live) {
    const any = await LunchOrder.exists({ classId, studentId, dayYMD }).session(session);
    return any
      ? no("no_live_order", "ออเดอร์ถูกยกเลิก ยังไม่มี QR ใหม่")
      : no("no_qr", "ยังไม่ได้รับ QR");
  }
  if (!REASSIGN_STATUSES.includes(live.status)) {
    return no("not_allowed_status", "สถานะนี้โยกร้านไม่ได้");
  }
  if (live.redeemedAt) return no("already_used", "ร้านใช้คูปองแล้ว โยกร้านไม่ได้");
  if (targetId && out.fromRestaurantId === String(targetId)) {
    return no("same_shop", "อยู่ร้านนี้อยู่แล้ว");
  }
  return { ...out, eligible: true, live };
}

function publicLearner({ live, ...rest }) {
  return rest;
}

/** คูปองของใบที่ร้านปลายทาง — ลำดับเดียวกับ lunchSubmit (กระดาษก่อน -> fallback e-coupon / ร้าน e-coupon) */
async function assignReassignCoupon({ target, orderId, dayYMD, needed, session }) {
  if (target.usesCouponStock) {
    const code = await assignCode({ restaurantId: target.id, dayYMD, orderId, session });
    if (code) return { couponCode: code.code, couponSource: "stock", stockCodeId: code._id };
    if (!target.stockFallback) {
      fail(409, "stock_insufficient", stockShortMessage(target, needed), {
        needed,
        available: target.stockAvailable || 0,
      });
    }
  }
  // e-coupon: เลือกรหัสที่ยังไม่มีใครใช้ก่อนเขียน (อ่านอย่างเดียว ไม่ทำให้ transaction ตาย) — ชุดใหญ่จึงไม่ชน
  // รหัสที่มีอยู่แล้วจน retry หมด · ยังชนได้ถ้ามีคนเขียนรหัสเดียวกันพร้อมกัน -> E11000 แล้ว
  // withCouponCodeRetry ใน reassignLunchCoupon ทำทั้งชุดใหม่
  for (let i = 0; i < REASSIGN_ECOUPON_ATTEMPTS; i += 1) {
    const c = generateECouponCode();
    const taken = await LunchOrder.exists({ eCouponCode: c }).session(session);
    if (!taken) return { couponCode: c, couponSource: "ecoupon", stockCodeId: null, eCouponCode: c };
  }
  fail(500, "ecoupon_failed", "ออก e-coupon ไม่สำเร็จ ยังไม่ได้โยกใคร กรุณาลองใหม่");
  return null;
}

/** โยก 1 คน (อยู่ใน transaction ของทั้งชุด) */
async function reassignOne({ ev, target, dayYMD, needed, at, by, adminId, note, ctx, req, session }) {
  const live = ev.live;
  let orderId = live._id;
  let cancel = null;

  if (live.status !== "pending") {
    // ยกเลิกใบเดิมด้วยกติกาเดิม (คืนคลัง / รอคืน / void) — audit เขียนเป็น lunch.reassign ครั้งเดียวด้านล่าง
    cancel = await cancelLunchOrder({
      orderId: live._id,
      adminId,
      reason: "reassigned",
      auditAction: "lunch.reassign",
      ctx,
      req,
      now: at,
      session,
    });
    const res = await issueLunchOrder({
      studentId: live.studentId,
      classId: live.classId,
      dayYMD,
      now: at,
      reopenCount: live.reopenCount || 0,
      session,
    });
    if (!res.ok) fail(409, res.reason || "issue_failed", issueReasonMessage(res.reason));
    if (!res.created) fail(409, "conflict", REASSIGN_CONFLICT_MESSAGE);
    orderId = res.order._id;
  }

  const coupon = await assignReassignCoupon({ target, orderId, dayYMD, needed, session });
  const reassignedFrom = {
    orderId: live._id,
    status: live.status,
    restaurantId: live.restaurantId || null,
    restaurantName: live.restaurantName || "",
    couponCode: live.couponCode || "",
    couponEffect: cancel?.couponEffect || "",
    at,
    by,
    reason: note,
  };

  const updated = await LunchOrder.findOneAndUpdate(
    { _id: orderId, status: "pending", activeKey: { $exists: true }, redeemedAt: null },
    {
      $set: {
        status: "at_shop",
        nickname: live.nickname || "",
        restaurantId: target.id,
        restaurantName: target.name,
        usesCouponStock: target.usesCouponStock,
        lines: [],
        itemsTotal: 0,
        budget: LUNCH_BUDGET_THB,
        overBudget: 0,
        couponCode: coupon.couponCode,
        couponSource: coupon.couponSource,
        stockCodeId: coupon.stockCodeId,
        ...(coupon.eCouponCode ? { eCouponCode: coupon.eCouponCode } : {}),
        // ไม่ตรงกับ requestId ของผู้เรียนคนไหน -> submit ที่ค้างอยู่ตอบ already_ordered
        submitRequestId: `reassign:${crypto.randomUUID()}`,
        submittedAt: at,
        reassignedFrom,
      },
    },
    { new: true, session },
  ).lean();
  if (!updated) fail(409, "conflict", `${ev.name}: ${REASSIGN_CONFLICT_MESSAGE}`);

  return { ev, order: updated, from: reassignedFrom, couponEffect: cancel?.couponEffect || "none" };
}

/**
 * R3 (B2): ตรวจก่อนโยก (อ่านอย่างเดียว) — ไม่ส่ง targetRestaurantId = ดูรายชื่อร้าน + สิทธิ์ของแต่ละคน
 * คืน { ok, dayYMD, window, shops, learners, eligibleCount, target }
 */
export async function previewLunchReassign({ learners, date, targetRestaurantId, now }) {
  const at = now ? new Date(now) : lunchNow();
  const list = normalizeReassignLearners(learners);
  const dayYMD = isYMD(clean(date)) ? clean(date) : toBkkYMD(at);
  const targetId = isObjectId(targetRestaurantId) ? String(targetRestaurantId) : "";

  const shops = await reassignShops(dayYMD);
  const rows = [];
  for (const learner of list) {
    rows.push(publicLearner(await evaluateReassignLearner({ learner, dayYMD, at, targetId })));
  }
  const eligibleCount = rows.filter((r) => r.eligible).length;

  let target = null;
  if (targetId) {
    target = reassignCapacity(shops.find((s) => s.id === targetId), eligibleCount) || {
      id: targetId,
      available: false,
      reason: "not_in_calendar",
      reasonLabel: "ร้านนี้ไม่ได้อยู่ใน Food Calendar ของวันนี้",
      enough: false,
    };
  }

  return {
    ok: true,
    dayYMD,
    window: reassignWindowProblem(dayYMD, at),
    shops,
    learners: rows,
    eligibleCount,
    target,
  };
}

/**
 * R3 (B1): โยกผู้เรียน (คูปอง) ไปร้านอื่น — ทั้งชุดใน transaction เดียว (ได้ทุกคน หรือไม่ได้เลย)
 *   learners : [{ studentId, classId }]
 *   actor    : ctx ของ requirePerm (ผู้ทำ = แอดมิน)
 * คืน { ok, dayYMD, target, moved: [{ name, fromRestaurantName, toRestaurantName, oldCouponCode, newCouponCode, ... }] }
 */
export async function reassignLunchCoupon({
  learners,
  date,
  targetRestaurantId,
  actor = null,
  reason = "",
  req = null,
  now,
}) {
  const at = now ? new Date(now) : lunchNow();
  const ctx = actor || null;
  const adminId = ctx?.userId || null;
  const by = adminDisplayName(ctx) || (adminId ? String(adminId) : "");
  const list = normalizeReassignLearners(learners);
  const dayYMD = clean(date);
  if (!isYMD(dayYMD)) fail(400, "bad_request", "ข้อมูลไม่ครบ (วันที่)");
  if (!isObjectId(targetRestaurantId)) fail(400, "bad_request", "กรุณาเลือกร้านปลายทาง");
  const targetId = String(targetRestaurantId);
  const note = clean(reason).slice(0, 300);

  let moved = [];
  let target = null;

  // R3x-1: รหัส e-coupon ชนกันตอนเขียน (E11000 — transaction ตาย) -> ทำทั้งชุดใหม่ด้วย transaction ใหม่
  //        (รหัสสุ่มใหม่ใน attempt ใหม่) · E11000 ของ index อื่น (activeKey) = conflict ไม่ retry
  try {
    await withCouponCodeRetry(
      () =>
        inTransaction(async (session) => {
          moved = [];
          target = null;

          const w = reassignWindowProblem(dayYMD, at);
          if (w) fail(409, w.reason, w.message);

          const shops = await reassignShops(dayYMD, session);
          target = shops.find((s) => s.id === targetId) || null;
          if (!target) {
            fail(409, "target_unavailable", "ร้านปลายทางไม่ได้อยู่ใน Food Calendar ของวันนี้");
          }
          if (!target.available && target.reason !== "stock_out") {
            fail(409, "target_unavailable", `ร้าน ${target.name}: ${target.reasonLabel}`);
          }

          const evs = [];
          for (const learner of list) {
            evs.push(await evaluateReassignLearner({ learner, dayYMD, at, targetId, session }));
          }
          const bad = evs.filter((e) => !e.eligible);
          if (bad.length) {
            fail(
              409,
              "not_eligible",
              `โยกไม่ได้ ยังไม่ได้โยกใคร — ${bad.map((b) => `${b.name || "ผู้เรียน"}: ${b.message}`).join(", ")}`,
              { notEligible: bad.map(publicLearner) },
            );
          }

          // ร้าน stock ที่ไม่มี fallback: กระดาษต้องพอทั้งชุด ไม่โยกบางส่วน
          const needed = evs.length;
          if (target.usesCouponStock && !target.stockFallback && (target.stockAvailable || 0) < needed) {
            fail(409, "stock_insufficient", stockShortMessage(target, needed), {
              needed,
              available: target.stockAvailable || 0,
            });
          }

          for (const ev of evs) {
            moved.push(
              await reassignOne({ ev, target, dayYMD, needed, at, by, adminId, note, ctx, req, session }),
            );
          }
        }),
      {
        onExhausted: () =>
          fail(503, "ecoupon_code_busy", "ออกรหัส e-coupon ไม่สำเร็จ ยังไม่ได้โยกใคร กรุณาลองใหม่"),
      },
    );
  } catch (e) {
    if (isDuplicateKey(e)) fail(409, "conflict", REASSIGN_CONFLICT_MESSAGE);
    throw e;
  }

  // audit หลัง commit: 1 รายการต่อคน (ไม่มี audit ยกเลิกแยกของใบเดิม)
  for (const m of moved) {
    await writeLunchAudit({
      ctx,
      req,
      action: "lunch.reassign",
      order: m.order,
      before: {
        status: m.from.status,
        restaurantName: m.from.restaurantName,
        couponCode: m.from.couponCode,
      },
      after: {
        status: "at_shop",
        restaurantName: m.order.restaurantName,
        couponCode: m.order.couponCode,
      },
      meta: {
        statusBefore: m.from.status,
        statusAfter: "at_shop",
        oldOrderId: String(m.from.orderId),
        newOrderId: String(m.order._id),
        fromRestaurantId: m.from.restaurantId ? String(m.from.restaurantId) : "",
        fromRestaurantName: m.from.restaurantName,
        toRestaurantId: String(m.order.restaurantId || ""),
        toRestaurantName: m.order.restaurantName,
        oldCouponCode: m.from.couponCode,
        couponCode: m.order.couponCode,
        couponSource: m.order.couponSource,
        couponEffect: m.couponEffect,
        reason: note,
        adminId: adminId ? String(adminId) : null,
      },
    });
  }

  return {
    ok: true,
    dayYMD,
    target: { id: target.id, name: target.name },
    moved: moved.map((m) => ({
      studentId: m.ev.studentId,
      classId: m.ev.classId,
      name: m.ev.name,
      orderId: String(m.order._id),
      oldOrderId: String(m.from.orderId),
      fromRestaurantName: m.from.restaurantName,
      toRestaurantName: m.order.restaurantName,
      oldCouponCode: m.from.couponCode,
      newCouponCode: m.order.couponCode,
      couponSource: m.order.couponSource,
      couponEffect: m.couponEffect,
    })),
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
 *   คืน { viewQr, regenerate, cancelCoupon, cancelForEdit, issue, handout, return, reassign }
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

  // R3: โยกไปร้านอื่น — มีเฉพาะเมื่อโยกได้ (ร้านปลายทางเลือกในโมดัล · server ตรวจซ้ำทั้งหมดตอนกด)
  //     รอสั่ง / สั่งแล้ว / ไปสั่งที่ร้าน + มีใบ live + วันนี้ก่อนปิด + ร้านยังไม่ใช้คูปอง + ตัวเลือกเป็นคูปอง
  if (
    ["pending", "ordered", "at_shop"].includes(status) &&
    live &&
    !win &&
    !choiceProblemOf(currentChoice, false)
  ) {
    a.reassign = ALLOW;
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
