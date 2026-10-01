// src/lib/lunchOrders.server.js
//
// ออก token ให้ผู้เรียน และประกอบ DTO ของหน้าสั่งอาหารบนมือถือ
//
// token คือความลับเพียงอย่างเดียวที่ใช้เปิดหน้านี้ — ไม่มี studentId
// ทั้งขาเข้าและขาออก DTO จึงต้องไม่หลุด id ของผู้เรียนออกไปเด็ดขาด

import crypto from "node:crypto";

import LunchOrder from "@/models/LunchOrder";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Restaurant from "@/models/Restaurant";

import {
  LUNCH_BUDGET_THB,
  defaultDeadline,
  finalCloseAt,
  orderWindow,
  toBkkYMD,
} from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import {
  getDaySet,
  getCouponAvailability,
} from "@/lib/couponAvailability.server";
import { countAvailable } from "@/lib/couponStock.server";

/* ---------------- token ---------------- */

export function makeLunchToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function activeKeyOf(classId, studentId, dayYMD) {
  return `${classId}:${studentId}:${dayYMD}`;
}

/* ---------------- derived status ---------------- */

// C1: "forfeited" (ตัดสิทธิ์) ไม่เคยถูกเก็บลง DB — คำนวณตอนอ่านเสมอ
//     = pending และถึง 15:00 ของวันนั้นแล้ว
//     pending ที่เลย deadlineAt แต่ยังไม่ถึง 15:00 ยังเป็น pending (สั่งแบบย่อได้)
export function computeStatus(order, now = lunchNow()) {
  const stored = String(order?.status || "pending");
  if (stored !== "pending") return stored;

  const finalClose = order?.dayYMD ? finalCloseAt(order.dayYMD) : null;
  if (finalClose && new Date(now).getTime() >= finalClose.getTime()) {
    return "forfeited";
  }
  return "pending";
}

/* ---------------- e-coupon status (C2) ---------------- */

/**
 * สถานะคูปองของออเดอร์ e-coupon ใบหนึ่ง (ตัวเดียวทั้ง endpoint และ server render)
 *   used    : ร้านกดใช้แล้ว (redeemedAt) — คงเป็น used ไม่ว่าเวลาจะผ่านไปเท่าไร
 *   expired : ยังไม่ใช้ และถึง 15:00 ของวันนั้นแล้ว
 *   unused  : นอกนั้น
 */
export function couponStateOf(order, now = lunchNow()) {
  if (order?.redeemedAt) {
    return { state: "used", usedAt: new Date(order.redeemedAt).toISOString() };
  }
  const finalClose = order?.dayYMD ? finalCloseAt(order.dayYMD) : null;
  if (finalClose && new Date(now).getTime() >= finalClose.getTime()) {
    return { state: "expired" };
  }
  return { state: "unused" };
}

/** ออเดอร์ที่ใช้ QR + รหัส e-coupon (ร้านที่ไม่ใช้คูปอง stock) */
export function isECouponOrder(order) {
  return order?.couponSource === "ecoupon" && !!order?.couponCode;
}

/* ---------------- issue ---------------- */

/**
 * ออกออเดอร์ (และ token) ให้ 1 คน/1 คลาส/1 วัน
 * - idempotent: ถ้ามีใบที่ยังไม่ถูกยกเลิกอยู่แล้ว คืนใบเดิมพร้อม token เดิม
 *   ไม่ว่าสถานะจะเป็นอะไร
 * - race-safe: พึ่ง unique index ของ activeKey แล้วจับ E11000 อ่านใหม่
 * - P4a: deadlineAt / reopenCount (optional) ใช้ตอนแอดมินออก QR ใหม่หลังยกเลิก
 *   ไม่ส่ง = เส้นตายปกติของวันนั้น, reopenCount 0 เหมือนเดิม
 */
export async function issueLunchOrder({
  studentId,
  classId,
  dayYMD,
  now,
  deadlineAt,
  reopenCount,
}) {
  const at = now ? new Date(now) : lunchNow();
  const ymd = String(dayYMD || "").slice(0, 10) || toBkkYMD(at);

  if (!studentId || !classId) {
    return { ok: false, reason: "missing_ids" };
  }

  const [student, klass] = await Promise.all([
    Student.findById(studentId).select("name thaiName engName classId").lean(),
    Class.findById(classId)
      .select("title courseName customCourseName room days disableCoupon")
      .lean(),
  ]);

  if (!student) return { ok: false, reason: "student_not_found" };
  if (!klass) return { ok: false, reason: "class_not_found" };

  // คลาสที่ปิดคูปองไว้ ไม่ต้องออก token ให้เลย
  if (klass.disableCoupon) {
    return { ok: false, reason: "class_disabled" };
  }

  // วันนั้นต้องมีร้านคูปองที่เปิดรับจริง (กฎเดียวกับ tablet / checkin)
  const daySet = await getDaySet(ymd);
  const avail = await getCouponAvailability({
    classDoc: klass,
    dayYMD: ymd,
    daySet,
  });
  if (!avail.available) {
    return { ok: false, reason: avail.reason || "no_coupon_restaurant" };
  }

  const key = activeKeyOf(classId, studentId, ymd);

  // มีใบที่ยัง live อยู่แล้ว -> คืนใบเดิม
  const existing = await LunchOrder.findOne({ activeKey: key }).lean();
  if (existing) return { ok: true, order: existing, created: false };

  const doc = {
    classId,
    studentId,
    dayYMD: ymd,
    activeKey: key,
    token: makeLunchToken(),
    tokenIssuedAt: at,
    deadlineAt: deadlineAt ? new Date(deadlineAt) : defaultDeadline(ymd),
    reopenCount: Number.isInteger(reopenCount) && reopenCount > 0 ? reopenCount : 0,
    status: "pending",
    holderName: student.name || student.thaiName || student.engName || "",
    courseName: klass.customCourseName || klass.courseName || klass.title || "",
    roomName: klass.room || "",
    budget: LUNCH_BUDGET_THB,
  };

  try {
    const created = await LunchOrder.create(doc);
    return { ok: true, order: created.toObject(), created: true };
  } catch (err) {
    // ใครสักคนชนะ race ไปก่อน -> อ่านใบของผู้ชนะกลับมา
    if (err?.code === 11000) {
      const winner = await LunchOrder.findOne({ activeKey: key }).lean();
      if (winner) return { ok: true, order: winner, created: false };
    }
    throw err;
  }
}

/* ---------------- session DTO ---------------- */

function restaurantState(entryMode, isStock, stockCount) {
  if (entryMode === "closed") return "closed";
  if (isStock && stockCount <= 0) return "sold_out";
  return "open";
}

/**
 * DTO ของหน้าสั่งอาหาร
 *   null            -> ไม่รู้จัก token
 *   { gone: true }  -> ถูกยกเลิก/ถูกแทนที่แล้ว
 */
export async function getLunchSession(token, now = lunchNow()) {
  const t = String(token || "").trim();
  if (!t) return null;

  const order = await LunchOrder.findOne({ token: t }).lean();
  if (!order) return null;

  // ยกเลิกแล้ว = token ใบนี้ตายแล้ว (P4 จะออกใบใหม่แทน)
  if (order.status === "cancelled" || !order.activeKey) {
    return { gone: true };
  }

  const at = new Date(now);
  const ymd = order.dayYMD;

  const daySet = await getDaySet(ymd);

  // ร้านที่วันนั้นตั้งเป็น coupon หรือ closed เท่านั้น — ร้าน set-menu ไม่เกี่ยว
  const entries = (daySet?.entries || []).filter(
    (e) => e?.mode === "coupon" || e?.mode === "closed",
  );
  const modeById = new Map(
    entries.map((e) => [String(e.restaurant), e.mode]),
  );

  let restaurants = [];
  if (entries.length > 0) {
    const docs = await Restaurant.find({
      _id: { $in: entries.map((e) => e.restaurant) },
      couponEnabled: true,
      isActive: { $ne: false },
    })
      .select("name logoUrl usesCouponStock")
      .lean();

    restaurants = await Promise.all(
      docs.map(async (r) => {
        const isStock = !!r.usesCouponStock;
        const stockCount = isStock ? await countAvailable(r._id, ymd) : 0;
        return {
          id: String(r._id),
          name: r.name || "",
          logo: r.logoUrl || "",
          isStock,
          // ไม่ส่งจำนวนคงเหลือออกไป ให้รู้แค่ว่าหมดหรือยัง
          state: restaurantState(modeById.get(String(r._id)), isStock, stockCount),
        };
      }),
    );
  }

  const status = computeStatus(order, at);

  // สรุปออเดอร์ที่บันทึกไว้
  // pending = ยังไม่สั่ง, forfeited = ถึง 15:00 โดยไม่ได้สั่ง — ทั้งคู่ไม่มีอะไรให้สรุป
  const placed = order.status === "ordered" || order.status === "at_shop";

  let orderSummary = null;
  if (placed) {
    // โลโก้ร้านเก็บไว้ที่ Restaurant ไม่ได้ snapshot ลงออเดอร์
    const rid = order.restaurantId ? String(order.restaurantId) : null;
    const fromList = restaurants.find((r) => r.id === rid);

    orderSummary = {
      mode: order.status === "at_shop" ? "at_shop" : "order",
      restaurantId: rid,
      restaurantName: order.restaurantName || fromList?.name || "",
      restaurantLogo: fromList?.logo || "",
      isStock: !!order.usesCouponStock,

      lines: (order.lines || []).map((l) => ({
        menuId: l.menuId ? String(l.menuId) : null,
        name: l.name || "",
        image: l.imageUrl || "",
        unitPrice: l.unitPrice || 0,
        qty: l.qty || 0,
        options: (l.options || []).map((o) => ({
          groupName: o.groupName || "",
          choiceName: o.choiceName || "",
          priceDelta: o.priceDelta || 0,
        })),
        note: l.note || "",
        lineTotal: l.lineTotal || 0,
      })),

      itemsTotal: order.itemsTotal || 0,
      budget: order.budget ?? LUNCH_BUDGET_THB,
      overBudget: order.overBudget || 0,

      couponCode: order.couponCode || "",
      couponSource: order.couponSource || "",
      // C2: สถานะคูปอง ณ ตอน render — หน้าแรกถูกต้องทันทีโดยไม่ต้องรอ poll
      coupon: isECouponOrder(order) ? couponStateOf(order, at) : null,

      holderName: order.holderName || "",
      nickname: order.nickname || "",
      roomName: order.roomName || "",
      dayYMD: ymd,
      submittedAt: order.submittedAt || null,
    };
  }

  return {
    learner: {
      fullName: order.holderName || "",
      nickname: order.nickname || "",
    },
    class: {
      name: order.courseName || "",
      room: order.roomName || "",
      dayYMD: ymd,
    },
    budget: order.budget ?? LUNCH_BUDGET_THB,
    window: orderWindow(
      { dayYMD: ymd, deadlineAt: order.deadlineAt },
      at,
    ),
    status,
    restaurants,
    order: orderSummary,
  };
}

/* ---------------- เปลี่ยนใจไม่เอาคูปองแล้ว ---------------- */

// P4a: cancelPendingLunchOrderOnChoiceChange ย้ายไป lunchAdmin.server.js แล้ว
//      (ยกเลิกผ่าน cancelLunchOrder ตัวเดียว จึงคืนคูปอง stock ได้ด้วย)

export { activeKeyOf };

/** ใช้ร่วมกับ /menu — ต้องรู้ว่าร้านนี้อยู่โหมด coupon ของวันนั้นจริงไหม */
export async function getOrderByToken(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  return LunchOrder.findOne({ token: t }).lean();
}
