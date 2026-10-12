// src/lib/couponStockImport.server.js
// ตรรกะการตรวจรหัสที่ import เข้ามา ใช้ร่วมกันทั้ง /import/preview และ /import
// เพื่อให้ preview กับของจริงตัดสินเหมือนกันเป๊ะ
import CouponStockCode from "@/models/CouponStockCode";
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
 * ตรวจข้อมูลล็อต (เมื่อหน้า import ส่ง importType มา)
 *   new      : ต้องมีชื่อล็อต และชื่อนี้ต้องยังไม่เคยใช้ในร้านนี้
 *   existing : ล็อตต้องมีอยู่แล้วในร้านนี้ ด้วยวันหมดอายุเดียวกัน
 * ไม่ส่ง importType มา = พฤติกรรมเดิม (ไม่ตรวจล็อต)
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

  if (!importType) return;
  if (importType !== "new" && importType !== "existing") {
    throw new CouponImportError("ประเภทการนำเข้าไม่ถูกต้อง");
  }
  if (!importBatch) throw new CouponImportError("กรุณาระบุชื่อล็อต");

  if (importType === "new") {
    const taken = await CouponStockCode.exists({
      restaurant: restaurantId,
      importBatch,
    });
    if (taken) {
      throw new CouponImportError(
        `ชื่อล็อต "${importBatch}" มีอยู่แล้วในร้านนี้`,
        409,
      );
    }
    return;
  }

  const lot = await CouponStockCode.exists({
    restaurant: restaurantId,
    importBatch,
    expiresYMD,
  });
  if (!lot) {
    throw new CouponImportError(
      `ไม่พบล็อต "${importBatch}" หมดอายุ ${expiresYMD} ในร้านนี้`,
      404,
    );
  }
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
