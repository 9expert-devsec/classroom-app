// src/lib/couponCodeRetry.server.js
//
// R3x-1: รหัส e-coupon (9XP-XXXX) ชนกับรหัสเดิม = E11000 บน unique index eCouponCode
// E11000 ใน transaction ทำให้ transaction นั้นตายทั้งก้อน (withTransaction retry เฉพาะ
// TransientTransactionError / UnknownTransactionCommitResult) — ลองรหัสใหม่ "ใน" transaction เดิมไม่ได้
// จึงต้องครอบ "ทั้ง transaction": ชนรหัส -> จบ attempt เดิม (session ปิดแล้ว) -> สุ่มรหัสใหม่ -> ทำทั้งหมดใหม่
//
// fn ต้องเป็นฟังก์ชันของ input ล้วน ๆ: เปิด session/transaction เอง และสุ่มรหัสใหม่ทุก attempt
// (ไม่มีสถานะค้างข้าม attempt) · error อื่นทุกชนิด (รวม E11000 ของ index อื่น) โยนต่อทันที ไม่ retry

export const COUPON_CODE_ATTEMPTS = 5;

function duplicateKeyErrorOf(err) {
  if (err?.code === 11000) return err;
  if (err?.cause?.code === 11000) return err.cause;
  return null;
}

/** E11000 ที่เกิดจาก unique index ของ eCouponCode เท่านั้น */
export function isECouponCodeCollision(err) {
  const e = duplicateKeyErrorOf(err);
  if (!e) return false;
  if (e.keyPattern && typeof e.keyPattern === "object") return "eCouponCode" in e.keyPattern;
  if (e.keyValue && typeof e.keyValue === "object") return "eCouponCode" in e.keyValue;
  // driver เก่าที่ไม่มี keyPattern/keyValue — ดูชื่อ index ในข้อความ
  return /index:\s*eCouponCode_1\b/.test(String(e.errmsg || e.message || ""));
}

/**
 * รัน fn(attempt) ใหม่ทั้งก้อนเมื่อรหัส e-coupon ชน (สูงสุด attempts ครั้ง)
 * ครบแล้วยังชน -> onExhausted() (ควร throw error ของผู้เรียก) ไม่ส่ง = throw Error ธรรมดา
 */
export async function withCouponCodeRetry(fn, { attempts = COUPON_CODE_ATTEMPTS, onExhausted } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isECouponCodeCollision(err)) throw err;
      console.warn(`[couponCodeRetry] e-coupon code collision (attempt ${attempt}/${attempts})`);
      if (attempt >= attempts) {
        if (onExhausted) onExhausted(err);
        throw new Error("ออกรหัส e-coupon ไม่สำเร็จ กรุณาลองใหม่");
      }
    }
  }
}
