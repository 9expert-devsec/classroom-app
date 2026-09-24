// src/lib/couponStockImport.server.js
// ตรรกะการตรวจรหัสที่ import เข้ามา ใช้ร่วมกันทั้ง /import/preview และ /import
// เพื่อให้ preview กับของจริงตัดสินเหมือนกันเป๊ะ
import CouponStockCode from "@/models/CouponStockCode";
import Restaurant from "@/models/Restaurant";
import { normalizeStockCode, isValidStockCode } from "@/lib/couponStock.server";
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
    .select("name usesCouponStock")
    .lean();
  if (!restaurant) throw new CouponImportError("ไม่พบร้านอาหาร", 404);

  if (!restaurant.usesCouponStock) {
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
 * แยกรหัสที่วางมาเป็น 4 กลุ่ม
 *   valid       : ใหม่ ใช้ได้ พร้อมบันทึก
 *   duplicate   : ซ้ำกันเองในข้อความที่วางมา (นับเฉพาะครั้งที่ 2 เป็นต้นไป)
 *   exists      : มีอยู่แล้วในร้านนี้
 *   invalid     : รูปแบบไม่ผ่าน
 */
export async function classifyCodes({ restaurantId, codesText }) {
  const lines = String(codesText || "")
    .split(/[\r\n,;\t]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const invalid = [];
  const duplicate = [];
  const seen = new Set();
  const candidates = [];

  for (const line of lines) {
    const code = normalizeStockCode(line);
    if (!isValidStockCode(code)) {
      invalid.push({ raw: line, code });
      continue;
    }
    if (seen.has(code)) {
      duplicate.push({ raw: line, code });
      continue;
    }
    seen.add(code);
    candidates.push(code);
  }

  let exists = [];
  let valid = candidates;

  if (candidates.length > 0) {
    const found = await CouponStockCode.find({
      restaurant: restaurantId,
      code: { $in: candidates },
    })
      .select("code status importBatch expiresYMD")
      .lean();

    const foundSet = new Set(found.map((f) => f.code));
    exists = found.map((f) => ({
      code: f.code,
      status: f.status,
      importBatch: f.importBatch || "",
      expiresYMD: f.expiresYMD || "",
    }));
    valid = candidates.filter((c) => !foundSet.has(c));
  }

  return {
    totalLines: lines.length,
    valid,
    duplicate,
    exists,
    invalid,
    counts: {
      valid: valid.length,
      duplicate: duplicate.length,
      exists: exists.length,
      invalid: invalid.length,
    },
  };
}
