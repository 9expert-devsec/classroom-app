// src/lib/couponStock.server.js
//
// วงจรชีวิตของคูปองกระดาษ (stock) ทุกการเปลี่ยนสถานะต้องผ่านที่นี่
//
//   available --assign--> assigned --handOut--> handed_out
//        ^                    |                      |
//        |                    | release              | release
//        +--------------------+                      v
//        +------------ confirmReturn ---------- awaiting_return
//
// ทุกฟังก์ชันเป็น conditional atomic update (ใส่สถานะเดิมไว้ใน filter)
// ห้ามอ่านมาก่อนแล้วค่อยเขียน เพราะสองคนกดพร้อมกันจะได้ใบเดียวกัน

import CouponStockCode from "@/models/CouponStockCode";

/* ---------------- code normalisation ---------------- */

// ตัดช่องว่างทั้งหมด (รวมที่แปะมาจาก Excel) แล้วทำเป็นตัวใหญ่
export function normalizeStockCode(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export const STOCK_CODE_REGEX = /^[A-Z0-9-]{4,40}$/;

export function isValidStockCode(raw) {
  return STOCK_CODE_REGEX.test(normalizeStockCode(raw));
}

/* ---------------- errors ---------------- */

export class CouponStockError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "CouponStockError";
    this.status = status;
  }
}

/* ---------------- read ---------------- */

/** จำนวนคูปองที่ยังใช้ได้จริงของร้านนั้น ณ วันนั้น (ยังไม่หมดอายุ) */
export async function countAvailable(restaurantId, dayYMD) {
  if (!restaurantId) return 0;
  const q = { restaurant: restaurantId, status: "available" };
  if (dayYMD) q.expiresYMD = { $gte: String(dayYMD).slice(0, 10) };
  return CouponStockCode.countDocuments(q);
}

/* ---------------- lifecycle ---------------- */

/**
 * จองคูปอง 1 ใบให้ออเดอร์ — atomic ครั้งเดียว
 * เรียงตามวันหมดอายุก่อน (ใบที่ใกล้หมดอายุถูกใช้ก่อน) แล้วค่อยตามลำดับที่ import
 * คืน null = ของหมด (ไม่ throw เพราะเป็นเคสปกติที่ caller ต้องจัดการ)
 */
export async function assignCode({ restaurantId, dayYMD, orderId, session }) {
  if (!restaurantId) return null;

  const filter = {
    restaurant: restaurantId,
    status: "available",
  };
  if (dayYMD) filter.expiresYMD = { $gte: String(dayYMD).slice(0, 10) };

  const opts = {
    sort: { expiresYMD: 1, createdAt: 1 },
    returnDocument: "after",
    new: true,
  };
  if (session) opts.session = session;

  return CouponStockCode.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "assigned",
        orderId: orderId || null,
        assignedAt: new Date(),
      },
    },
    opts,
  ).lean();
}

/** assigned -> handed_out (Counter ยื่นคูปองให้ผู้เรียนแล้ว) */
export async function markHandedOut(codeId) {
  const doc = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "assigned" },
    { $set: { status: "handed_out", handedOutAt: new Date() } },
    { new: true },
  ).lean();

  if (!doc) {
    throw new CouponStockError(
      "เปลี่ยนสถานะไม่ได้ (คูปองนี้ไม่ได้อยู่ในสถานะ 'ผูกแล้ว')",
    );
  }
  return doc;
}

/**
 * ยกเลิกออเดอร์:
 *   assigned   -> available      (ยังไม่ได้ยื่น คืนเข้าคลังได้เลย)
 *   handed_out -> awaiting_return (ยื่นไปแล้ว ต้องตามเก็บกระดาษคืน)
 */
export async function releaseCode(codeId) {
  const back = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "assigned" },
    {
      $set: {
        status: "available",
        orderId: null,
        assignedAt: null,
      },
    },
    { new: true },
  ).lean();
  if (back) return back;

  const pending = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "handed_out" },
    { $set: { status: "awaiting_return" } }, // คง orderId ไว้เพื่อตามของ
    { new: true },
  ).lean();
  if (pending) return pending;

  throw new CouponStockError(
    "คืนคูปองไม่ได้ (สถานะปัจจุบันไม่ใช่ 'ผูกแล้ว' หรือ 'ส่งมอบแล้ว')",
  );
}

/** awaiting_return -> available (ได้กระดาษคืนมาแล้ว) */
export async function confirmReturn(codeId) {
  const doc = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "awaiting_return" },
    {
      $set: {
        status: "available",
        orderId: null,
        assignedAt: null,
        returnedAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  if (!doc) {
    throw new CouponStockError(
      "ยืนยันรับคืนไม่ได้ (คูปองนี้ไม่ได้อยู่ในสถานะ 'รอคืน')",
    );
  }
  return doc;
}

/** available -> void (ตัดออกจากคลัง) */
export async function voidCode(codeId, reason) {
  const r = String(reason || "").trim();
  if (!r) throw new CouponStockError("กรุณาระบุเหตุผลในการยกเลิก", 400);

  const doc = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "available" },
    { $set: { status: "void", voidedAt: new Date(), voidReason: r } },
    { new: true },
  ).lean();

  if (!doc) {
    throw new CouponStockError(
      "ยกเลิกได้เฉพาะคูปองที่สถานะ 'พร้อมใช้' เท่านั้น",
    );
  }
  return doc;
}

/** void -> available */
export async function unvoidCode(codeId) {
  const doc = await CouponStockCode.findOneAndUpdate(
    { _id: codeId, status: "void" },
    { $set: { status: "available", voidedAt: null, voidReason: "" } },
    { new: true },
  ).lean();

  if (!doc) {
    throw new CouponStockError("คูปองนี้ไม่ได้อยู่ในสถานะ 'ยกเลิก'");
  }
  return doc;
}
