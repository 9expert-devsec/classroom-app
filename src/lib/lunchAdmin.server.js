// src/lib/lunchAdmin.server.js
//
// ยกเลิก / ออก QR ใหม่ / เปิดเวลาพิเศษ ของออเดอร์อาหารกลางวัน — ทางเดียวของทุกหน้า
//   - หน้าแอดมิน "ติดตามการสั่งอาหาร" (/api/admin/lunch/*)
//   - ผู้เรียนเปลี่ยนใจจากคูปองตอนเช็คอิน (choice_changed)
//
// กติกา:
//   - การยกเลิกกับการคืน/ย้ายสถานะคูปอง stock อยู่ใน transaction เดียวกัน
//   - ยกเลิก = ปลด activeKey ($unset) ให้ออกใบใหม่ได้ ตาม P3b
//   - ออก QR ใหม่ใช้ issueLunchOrder (race handling เดิม) ไม่ทำซ้ำเอง
//   - ทุกฟังก์ชันเขียน audit 1 รายการ (best-effort: audit ล้มไม่ทำให้งานล้ม)

import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";

import { issueLunchOrder, activeKeyOf } from "@/lib/lunchOrders.server";
import { releaseCode, CouponStockError } from "@/lib/couponStock.server";
import { reissueDeadline, toBkkYMD } from "@/lib/lunchConfig";
import { classDayIndexToday } from "@/lib/classDates";
import { writeAuditLog } from "@/lib/auditLog.server";

/* ---------------- errors ---------------- */

export class LunchAdminError extends Error {
  constructor(status, reason, message) {
    super(message);
    this.name = "LunchAdminError";
    this.status = status;
    this.reason = reason;
  }
}

function fail(status, reason, message) {
  throw new LunchAdminError(status, reason, message);
}

/**
 * แปลง error จาก requirePerm / ฟังก์ชันในไฟล์นี้ เป็น { status, body } แบบเดียวกันทุก route
 *   body = { error: ข้อความไทย, reason }
 */
export function lunchAdminErrorBody(err) {
  if (err instanceof LunchAdminError) {
    return { status: err.status, body: { error: err.message, reason: err.reason } };
  }
  if (err?.status === 401) {
    return { status: 401, body: { error: "กรุณาเข้าสู่ระบบ", reason: "unauthorized" } };
  }
  if (err?.status === 403) {
    return { status: 403, body: { error: "ไม่มีสิทธิ์ใช้งาน", reason: "forbidden" } };
  }
  console.error("[lunchAdmin] unexpected error:", err);
  return { status: 500, body: { error: "เกิดข้อผิดพลาดในระบบ", reason: "internal_error" } };
}

const CANCELLABLE = ["pending", "ordered", "at_shop"];

/* ---------------- audit ---------------- */

async function audit({ ctx, req, action, order, before, after, meta }) {
  try {
    await writeAuditLog({
      ctx: ctx || {},
      req,
      action,
      entityType: "LunchOrder",
      entityId: String(order?._id || ""),
      entityLabel: `${order?.holderName || "-"} • ${order?.dayYMD || ""}`.trim(),
      before,
      after,
      meta: {
        orderId: String(order?._id || ""),
        studentId: String(order?.studentId || ""),
        classId: String(order?.classId || ""),
        dayYMD: order?.dayYMD || "",
        ...meta,
      },
    });
  } catch (e) {
    console.warn("[lunchAdmin] writeAuditLog failed:", e?.message || e);
  }
}

/* ---------------- today guard ---------------- */

// dayYMD ต้องเป็น "วันนี้" (เวลาไทย) และวันนี้ต้องเป็นวันเรียนของคลาสนั้น
async function assertToday(classId, dayYMD, now) {
  const klass = await Class.findById(classId)
    .select("date days dayCount duration.dayCount")
    .lean();
  if (!klass) fail(404, "class_not_found", "ไม่พบคลาส");

  const todayYMD = toBkkYMD(now);
  if (String(dayYMD) !== todayYMD || !classDayIndexToday(klass, now)) {
    fail(409, "not_today", "ทำได้เฉพาะออเดอร์ของวันเรียนวันนี้เท่านั้น");
  }
}

/* ---------------- cancel ---------------- */

/**
 * ยกเลิกออเดอร์ (pending / ordered / at_shop) ใน transaction เดียว
 *   stock assigned   -> คืนเข้าคลัง (released)
 *   stock handed_out -> awaiting_return (ต้องตามรับกระดาษคืน)
 *   e-coupon         -> couponVoidedAt = now (รหัสยังอยู่ในออเดอร์)
 * คืน { order, statusBefore, couponEffect }
 */
export async function cancelLunchOrder({
  orderId,
  adminId = null,
  reason = "",
  ctx = null,
  req = null,
  auditAction = "lunch.cancel",
  cancelledBy,
  now,
}) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ""))) {
    fail(400, "bad_request", "ข้อมูลไม่ครบ");
  }

  const at = now ? new Date(now) : new Date();
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const order = await LunchOrder.findById(orderId).session(session).lean();
      if (!order) fail(404, "not_found", "ไม่พบออเดอร์");
      if (!CANCELLABLE.includes(order.status)) {
        fail(409, "not_cancellable", "ออเดอร์นี้ถูกยกเลิกไปแล้ว");
      }

      const set = {
        status: "cancelled",
        cancelledAt: at,
        cancelledBy: cancelledBy ?? (adminId ? String(adminId) : ""),
        cancelReason: String(reason || "").trim().slice(0, 300),
      };

      let couponEffect = "none";
      let stockStatusAfter = null;

      if (order.stockCodeId) {
        try {
          const code = await releaseCode(order.stockCodeId, { session });
          stockStatusAfter = code.status;
          couponEffect = code.status === "available" ? "released" : "awaiting_return";
        } catch (e) {
          // รหัสอยู่ในสถานะอื่นไปแล้ว (เช่น คืนมือไปแล้ว) — ยกเลิกออเดอร์ต่อได้
          if (!(e instanceof CouponStockError)) throw e;
          couponEffect = "none";
        }
      } else if (order.couponCode && order.couponSource === "ecoupon") {
        set.couponVoidedAt = at;
        couponEffect = "voided";
      }

      // conditional: สถานะต้องยังเหมือนตอนอ่าน ไม่งั้นมีคนแก้พร้อมกัน
      const upd = await LunchOrder.updateOne(
        { _id: order._id, status: order.status },
        { $set: set, $unset: { activeKey: "" } },
        { session },
      );
      if (upd.modifiedCount !== 1) {
        fail(409, "conflict", "ออเดอร์เพิ่งถูกเปลี่ยนสถานะ กรุณาลองใหม่");
      }

      result = { order, statusBefore: order.status, couponEffect, stockStatusAfter };
    });
  } finally {
    await session.endSession();
  }

  await audit({
    ctx,
    req,
    action: auditAction,
    order: result.order,
    before: { status: result.statusBefore },
    after: { status: "cancelled" },
    meta: {
      statusBefore: result.statusBefore,
      statusAfter: "cancelled",
      couponEffect: result.couponEffect,
      couponCode: result.order.couponCode || "",
      stockStatusAfter: result.stockStatusAfter,
      reason: String(reason || ""),
      adminId: adminId ? String(adminId) : null,
    },
  });

  return {
    orderId: String(result.order._id),
    statusBefore: result.statusBefore,
    couponEffect: result.couponEffect,
  };
}

/* ---------------- choice_changed (P3b path) ---------------- */

export const ORDER_LOCKED_MESSAGE =
  "ท่านสั่งอาหารแล้ว หากต้องการเปลี่ยน กรุณาติดต่อเจ้าหน้าที่ที่ Counter";

/**
 * ผู้เรียนกลับมาแก้ Step 2 แล้วเลือกอย่างอื่นที่ไม่ใช่คูปอง
 *   pending           -> ยกเลิกผ่าน cancelLunchOrder (คืน stock ได้ด้วย)
 *   ordered / at_shop -> ห้ามเปลี่ยนเอง ต้องให้ Counter จัดการ
 * คืน { ok: true, cancelled } หรือ { ok: false, reason, message }
 */
export async function cancelPendingLunchOrderOnChoiceChange({
  studentId,
  classId,
  dayYMD,
  now,
  req = null,
}) {
  if (!studentId || !classId || !dayYMD) return { ok: true, cancelled: false };

  const order = await LunchOrder.findOne({
    activeKey: activeKeyOf(classId, studentId, dayYMD),
  }).lean();

  if (!order) return { ok: true, cancelled: false };

  if (order.status === "ordered" || order.status === "at_shop") {
    return {
      ok: false,
      reason: "order_locked",
      message: ORDER_LOCKED_MESSAGE,
      orderId: String(order._id),
    };
  }

  if (order.status !== "pending") return { ok: true, cancelled: false };

  const res = await cancelLunchOrder({
    orderId: order._id,
    adminId: null,
    reason: "choice_changed",
    cancelledBy: "learner",
    auditAction: "lunch.cancel_choice_changed",
    req,
    now,
  });

  return {
    ok: true,
    cancelled: true,
    orderId: res.orderId,
    couponEffect: res.couponEffect,
  };
}

/* ---------------- reopen (new token) ---------------- */

/**
 * ออก QR ใหม่หลังยกเลิก — ได้ token ใหม่
 * เฉพาะวันนี้ และต้องไม่มีออเดอร์ที่ยังไม่ยกเลิกของ (คลาส, ผู้เรียน, วัน) นี้
 */
export async function reopenLunchOrder({
  classId,
  studentId,
  dayYMD,
  adminId = null,
  now,
  ctx = null,
  req = null,
}) {
  const at = now ? new Date(now) : new Date();
  if (
    !mongoose.Types.ObjectId.isValid(String(classId || "")) ||
    !mongoose.Types.ObjectId.isValid(String(studentId || ""))
  ) {
    fail(400, "bad_request", "ข้อมูลไม่ครบ");
  }

  await assertToday(classId, dayYMD, at);

  const live = await LunchOrder.findOne({
    activeKey: activeKeyOf(classId, studentId, dayYMD),
  })
    .select("_id status")
    .lean();
  if (live) {
    fail(409, "already_active", "ผู้เรียนมีออเดอร์ที่ยังใช้งานอยู่แล้ว");
  }

  const prev = await LunchOrder.findOne({ classId, studentId, dayYMD })
    .sort({ createdAt: -1 })
    .select("reopenCount")
    .lean();

  const deadlineAt = reissueDeadline(dayYMD, at);
  const res = await issueLunchOrder({
    studentId,
    classId,
    dayYMD,
    now: at,
    deadlineAt,
    reopenCount: (prev?.reopenCount || 0) + 1,
  });

  if (!res.ok) {
    fail(409, res.reason || "issue_failed", "ออก QR ใหม่ไม่ได้ (วันนี้ไม่มีร้านคูปองที่เปิดรับ)");
  }
  // มีคนออกใบใหม่ตัดหน้าไปก่อน (race) -> ถือว่ามีใบ live อยู่แล้ว
  if (!res.created) {
    fail(409, "already_active", "ผู้เรียนมีออเดอร์ที่ยังใช้งานอยู่แล้ว");
  }

  const order = res.order;
  await audit({
    ctx,
    req,
    action: "lunch.reopen",
    order,
    before: { status: "cancelled" },
    after: { status: "pending", deadlineAt: order.deadlineAt },
    meta: {
      statusBefore: prev ? "cancelled" : "none",
      statusAfter: "pending",
      couponEffect: "none",
      reopenCount: order.reopenCount,
      adminId: adminId ? String(adminId) : null,
    },
  });

  return {
    orderId: String(order._id),
    path: `/lunch/${order.token}`,
    deadlineAt: order.deadlineAt,
    reopenCount: order.reopenCount,
    holderName: order.holderName || "",
  };
}

/* ---------------- special open (same token) ---------------- */

/**
 * เปิดเวลาพิเศษให้ใบเดิม (token เดิม) — เฉพาะ pending (รวม unassigned) ของวันนี้
 */
export async function specialOpenLunchOrder({
  orderId,
  adminId = null,
  now,
  ctx = null,
  req = null,
}) {
  const at = now ? new Date(now) : new Date();
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ""))) {
    fail(400, "bad_request", "ข้อมูลไม่ครบ");
  }

  const order = await LunchOrder.findById(orderId).lean();
  if (!order) fail(404, "not_found", "ไม่พบออเดอร์");
  if (order.status !== "pending") {
    fail(409, "not_pending", "เปิดเวลาพิเศษได้เฉพาะออเดอร์ที่ยังไม่ได้สั่ง");
  }
  await assertToday(order.classId, order.dayYMD, at);

  const deadlineAt = reissueDeadline(order.dayYMD, at);
  const updated = await LunchOrder.findOneAndUpdate(
    { _id: order._id, status: "pending" },
    { $set: { deadlineAt }, $inc: { reopenCount: 1 } },
    { new: true },
  ).lean();
  if (!updated) fail(409, "conflict", "ออเดอร์เพิ่งถูกเปลี่ยนสถานะ กรุณาลองใหม่");

  await audit({
    ctx,
    req,
    action: "lunch.special_open",
    order: updated,
    before: { status: "pending", deadlineAt: order.deadlineAt },
    after: { status: "pending", deadlineAt: updated.deadlineAt },
    meta: {
      statusBefore: "pending",
      statusAfter: "pending",
      couponEffect: "none",
      reopenCount: updated.reopenCount,
      adminId: adminId ? String(adminId) : null,
    },
  });

  return {
    orderId: String(updated._id),
    path: `/lunch/${updated.token}`,
    deadlineAt: updated.deadlineAt,
    reopenCount: updated.reopenCount,
    holderName: updated.holderName || "",
  };
}
