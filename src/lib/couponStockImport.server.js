// src/lib/couponStockImport.server.js
// ตรรกะการตรวจรหัสที่ import เข้ามา ใช้ร่วมกันทั้ง /import/preview และ /import
// เพื่อให้ preview กับของจริงตัดสินเหมือนกันเป๊ะ
import CouponStockCode from "@/models/CouponStockCode";
import CouponStockLot, { lotNameKey } from "@/models/CouponStockLot";
import Restaurant from "@/models/Restaurant";
import {
  classifyLinesLocal,
  MAX_IMPORT_CODES,
  MAX_IMPORT_NOTE,
} from "@/lib/couponStockCode";
import { isYMD } from "@/lib/classDates";
import { toBkkYMD } from "@/lib/lunchConfig";

export class CouponImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CouponImportError";
    this.status = status;
  }
}

/** ตรวจร้าน + วันหมดอายุ ก่อนจะยุ่งกับรหัส */
export async function validateImportTarget({ restaurantId, expiresYMD }) {
  if (!restaurantId) throw new CouponImportError("กรุณาเลือกร้านอาหาร");

  const restaurant = await Restaurant.findById(restaurantId)
    .select("name couponEnabled usesCouponStock")
    .lean();
  if (!restaurant) throw new CouponImportError("ไม่พบร้านอาหาร", 404);

  // usesCouponStock is kept when coupon is turned off, so check both
  if (!restaurant.couponEnabled || !restaurant.usesCouponStock) {
    throw new CouponImportError(
      `ร้าน "${restaurant.name}" ยังไม่ได้เปิดใช้คูปอง stock`,
    );
  }

  const ymd = String(expiresYMD || "").slice(0, 10);
  if (!isYMD(ymd)) throw new CouponImportError("กรุณาระบุวันหมดอายุให้ถูกต้อง");

  // กันพิมพ์วันที่ผิดจนนำเข้าของหมดอายุมาตั้งแต่แรก
  const today = toBkkYMD(new Date());
  if (ymd < today) {
    throw new CouponImportError("วันหมดอายุต้องไม่เป็นวันที่ผ่านมาแล้ว");
  }

  return { restaurant, expiresYMD: ymd };
}

/**
 * R5-1: หาล็อต (CouponStockLot) ที่การ import ครั้งนี้จะเขียนลง
 *   new      : ต้องมีชื่อล็อต และชื่อนี้ (ไม่สนตัวพิมพ์) ต้องยังไม่เคยใช้ในร้านนี้ -> lot = null (สร้างใหม่)
 *   existing : ล็อตต้องมีอยู่แล้วในร้านนี้ ยังไม่ถูกยกเลิก และวันหมดอายุต้องตรงกับล็อต
 *   (ไม่ส่ง) : แบบเดิม (สคริปต์ dev seed) — ชื่อ+วันหมดอายุตรงกับล็อตเดิม = เติมเข้าล็อตนั้น
 *              ไม่เจอ = สร้างล็อตใหม่ · ชื่อซ้ำแต่วันหมดอายุไม่ตรง = ปฏิเสธ
 * คืน { lot } — lot = null แปลว่าต้องสร้างล็อตใหม่ตอนบันทึก
 * ใช้ทั้ง preview และ import (import เรียกซ้ำใน transaction ด้วย session)
 */
export async function resolveImportLot({
  restaurantId,
  importType,
  importBatch,
  expiresYMD,
  session = null,
}) {
  if (importType && importType !== "new" && importType !== "existing") {
    throw new CouponImportError("ประเภทการนำเข้าไม่ถูกต้อง");
  }
  if (importType && !importBatch) throw new CouponImportError("กรุณาระบุชื่อล็อต");

  const key = lotNameKey(importBatch);
  const findLot = (q) =>
    CouponStockLot.findOne({ restaurant: restaurantId, ...q }).session(session).lean();

  if (importType === "new") {
    const [lot, legacy] = await Promise.all([
      findLot({ nameKey: key }),
      // รหัสเก่าที่ยังไม่ backfill ล็อต
      CouponStockCode.exists({ restaurant: restaurantId, importBatch }).session(session),
    ]);
    if (lot || legacy) {
      throw new CouponImportError(
        `ชื่อล็อต "${importBatch}" มีอยู่แล้วในร้านนี้`,
        409,
      );
    }
    return { lot: null };
  }

  // ล็อตไม่มีชื่อ: แยกล็อตด้วยวันหมดอายุ (แบบเดียวกับ backfill)
  const lot = key
    ? await findLot({ nameKey: key })
    : await findLot({ nameKey: "", expiresYMD, status: "active" });

  if (lot) {
    if (lot.status === "cancelled") {
      throw new CouponImportError(
        `ล็อต "${lot.name || "ไม่ระบุล็อต"}" ถูกยกเลิกแล้ว เพิ่มรหัสไม่ได้`,
        409,
      );
    }
    if (lot.expiresYMD !== expiresYMD) {
      throw new CouponImportError(
        `ล็อต "${lot.name}" หมดอายุ ${lot.expiresYMD} ไม่ตรงกับ ${expiresYMD}`,
        409,
      );
    }
    return { lot };
  }

  if (importType === "existing") {
    // ล็อตเก่าที่ยังไม่ backfill: มีรหัสชื่อ+วันหมดอายุนี้อยู่ -> สร้างล็อตให้ตอนบันทึก
    // (backfill จะผูกรหัสเก่าเข้าล็อตเดียวกันทีหลัง เพราะหาล็อตด้วยชื่อ+วันหมดอายุ)
    const legacy = await CouponStockCode.exists({
      restaurant: restaurantId,
      importBatch,
      expiresYMD,
    }).session(session);
    if (!legacy) {
      throw new CouponImportError(
        `ไม่พบล็อต "${importBatch}" หมดอายุ ${expiresYMD} ในร้านนี้`,
        404,
      );
    }
  }
  return { lot: null };
}

/**
 * ตรวจหมายเหตุ + ล็อต (ไม่เขียนอะไร) — preview และ import ใช้ตัวเดียวกัน
 */
export async function validateImportLot({
  restaurantId,
  importType,
  importBatch,
  expiresYMD,
  note,
}) {
  if (String(note || "").length > MAX_IMPORT_NOTE) {
    throw new CouponImportError(
      `หมายเหตุต้องไม่เกิน ${MAX_IMPORT_NOTE} ตัวอักษร`,
    );
  }
  return resolveImportLot({ restaurantId, importType, importBatch, expiresYMD });
}

/**
 * แยกรหัสที่วางมาเป็น 4 กลุ่ม
 *   valid       : ใหม่ ใช้ได้ พร้อมบันทึก
 *   duplicate   : ซ้ำกันเองในข้อความที่วางมา (นับเฉพาะครั้งที่ 2 เป็นต้นไป)
 *   exists      : มีอยู่แล้วในร้านนี้
 *   invalid     : รูปแบบไม่ผ่าน
 * rows = ผลทีละบรรทัดตามลำดับที่วาง (result: ok | exists | duplicate | invalid)
 */
export async function classifyCodes({ restaurantId, codesText }) {
  const { lines, rows: localRows } = classifyLinesLocal(codesText);

  if (lines.length > MAX_IMPORT_CODES) {
    throw new CouponImportError(
      `นำเข้าได้ครั้งละไม่เกิน ${MAX_IMPORT_CODES.toLocaleString()} รหัส (วางมา ${lines.length.toLocaleString()} รหัส)`,
    );
  }

  const invalid = [];
  const duplicate = [];
  const candidates = [];

  for (const r of localRows) {
    if (r.result === "invalid") invalid.push({ raw: r.raw, code: r.code });
    else if (r.result === "duplicate") duplicate.push({ raw: r.raw, code: r.code });
    else candidates.push(r.code);
  }

  let exists = [];
  let valid = candidates;
  let foundSet = new Set();

  if (candidates.length > 0) {
    const found = await CouponStockCode.find({
      restaurant: restaurantId,
      code: { $in: candidates },
    })
      .select("code status importBatch expiresYMD")
      .lean();

    foundSet = new Set(found.map((f) => f.code));
    exists = found.map((f) => ({
      code: f.code,
      status: f.status,
      importBatch: f.importBatch || "",
      expiresYMD: f.expiresYMD || "",
    }));
    valid = candidates.filter((c) => !foundSet.has(c));
  }

  const rows = localRows.map((r) =>
    r.result === "ok" && foundSet.has(r.code) ? { ...r, result: "exists" } : r,
  );

  return {
    totalLines: lines.length,
    valid,
    duplicate,
    exists,
    invalid,
    rows,
    counts: {
      valid: valid.length,
      duplicate: duplicate.length,
      exists: exists.length,
      invalid: invalid.length,
    },
  };
}
