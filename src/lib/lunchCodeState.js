// src/lib/lunchCodeState.js
// R2a-3: สถานะของ "รหัสคูปองบนออเดอร์" (pure) — ออเดอร์เก็บ couponCode / stockCodeId ไว้เป็นประวัติเสมอ
// แต่ใบที่ยกเลิกแล้วต้องไม่แสดงรหัสเหมือนยังถืออยู่ (รหัส stock อาจถูกจองให้คนอื่นไปแล้ว)
//
//   held            : ใบยังไม่ถูกยกเลิก (ผู้ถือปัจจุบัน)
//   awaiting_return : ยกเลิกแล้ว รหัส stock ยังรอรับคืนจากใบนี้
//   returned        : ยกเลิกแล้ว เคยส่งมอบกระดาษ และรับคืนแล้ว (confirmReturn)
//   released        : ยกเลิกแล้ว ไม่เคยส่งมอบ รหัสคืนเข้า stock ทันที
//   voided          : ยกเลิกแล้ว e-coupon ถูก void
//   null            : ไม่มีรหัสบนออเดอร์ / ข้อมูลเก่าที่สรุปไม่ได้
//
// ใช้: order.status, order.couponCode, order.stockCodeId, order.couponVoidedAt, order.handedOutAt
//      code.status, code.orderId (CouponStockCode ของ stockCodeId — รับคืนแล้ว orderId ถูกล้าง
//      และรหัสอาจถูกจองให้ใบอื่น จึงดู "รอคืนจากใบนี้" ด้วย orderId เท่านั้น)

export function couponCodeStateOf(order, code = null) {
  if (!order || (!order.couponCode && !order.stockCodeId)) return null;
  if (order.status !== "cancelled") return "held";
  if (order.couponVoidedAt) return "voided";
  if (!order.stockCodeId) return null;

  const id = String(order._id || "");
  if (code?.status === "awaiting_return" && String(code.orderId || "") === id) {
    return "awaiting_return";
  }
  // เคยส่งมอบกระดาษ (ออเดอร์จำเวลาส่งมอบไว้) แต่ไม่ได้รอคืนจากใบนี้แล้ว = รับคืนไปแล้ว
  if (order.handedOutAt) return "returned";
  return "released";
}
