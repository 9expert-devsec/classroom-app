// src/lib/lunchCancelReasons.js
// R2a-2: cancelReason ของ LunchOrder -> ข้อความไทย (pure — ใช้ทั้ง server timeline และหน้าแอดมิน)

export const CANCEL_REASON_LABELS = {
  choice_changed: "เปลี่ยนตัวเลือกอาหาร",
  admin_cancel_coupon: "ยกเลิกคูปอง (ไม่รับอาหาร)",
  admin_cancel_for_edit: "ยกเลิกเพื่อแก้ไขออเดอร์",
  qr_regenerated: "ออก QR ใหม่ (QR เดิมใช้ไม่ได้)",
  // R3: แอดมินโยกผู้เรียนไปร้านอื่น (ใบใหม่อยู่ที่ร้านปลายทาง)
  reassigned: "ถูกโยกไปร้านอื่น",
};

/** byAdmin: ใบที่ไม่มีเหตุผลแต่ยกเลิกโดยแอดมิน (ปุ่ม "ยกเลิก" เดิม) */
export function cancelReasonLabel(reason, { byAdmin = false } = {}) {
  const r = String(reason || "").trim();
  if (!r) return byAdmin ? "ยกเลิกโดยผู้ดูแล" : "ยกเลิก";
  return CANCEL_REASON_LABELS[r] || r;
}
