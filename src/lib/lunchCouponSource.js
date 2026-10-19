// src/lib/lunchCouponSource.js
//
// คูปองของออเดอร์ "ที่ออกไปแล้ว" เป็นกระดาษ (stock) หรือ e-coupon — ตัดสินจากตัวออเดอร์เท่านั้น
// ห้ามดู Restaurant.usesCouponStock เพราะร้าน stock ออก e-coupon แทนได้เมื่อกระดาษหมด
// (stockFallbackToECoupon) และ flag ของร้านเปลี่ยนได้หลังออกคูปองไปแล้ว
//
// flag ของร้านยังเป็นตัวตัดสินสำหรับ "ออเดอร์ใหม่" เท่านั้น (lunchSubmit / availability)
// ไม่มี migration: ออเดอร์เก่าที่ไม่มี couponSource ดูจาก stockCodeId แทน

/** "stock" | "ecoupon" */
export function getOrderCouponSource(order) {
  const s = order?.couponSource;
  if (s === "stock" || s === "ecoupon") return s;
  // "generated" = ชื่อเดิมของ e-coupon จาก P1a
  if (s === "generated") return "ecoupon";
  return order?.stockCodeId ? "stock" : "ecoupon";
}

/** ออเดอร์ของร้าน stock ที่ได้ e-coupon แทนเพราะคูปองกระดาษหมด */
export function isStockFallbackOrder(order) {
  return !!order?.usesCouponStock && getOrderCouponSource(order) === "ecoupon";
}
