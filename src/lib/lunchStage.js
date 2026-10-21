// src/lib/lunchStage.js
// R2b: "คูปองของผู้เรียนคนนี้ วันนี้ อยู่ขั้นไหน" — ฟังก์ชันเดียว (pure) ที่ทั้ง Food Report
//      และหน้าติดตามการสั่งอาหารใช้ จะได้ไม่มีสอง mapping ที่ค่อย ๆ เพี้ยนออกจากกัน
//
// ขั้น (stage):
//   no_qr             : เลือกคูปอง แต่วันนั้นยังไม่เคยออก QR เลย
//   pending           : มี QR (ใบ live) ยังไม่สั่ง ก่อนเวลาปิด
//   cancelled_wait_qr : ใบล่าสุดถูกยกเลิก (เช่นยกเลิกเพื่อแก้ไข) ยังไม่มีใบใหม่ ก่อนเวลาปิด
//   forfeited         : ถึงเวลาปิด (15:00) โดยยังไม่ได้สั่ง — ไม่ว่าจะมี QR หรือไม่
//   ordered / at_shop : สั่งแล้ว (ขั้นย่อยของใบที่สั่งแล้ว — ส่งมอบ / ร้านใช้ ฯลฯ — ยังเป็นของแต่ละหน้าเหมือนเดิม)
//
// รหัส stock ของใบที่ยกเลิกแล้ว (couponCodeState) ต่อท้ายป้ายเมื่อยังต้องตามคืน

export const COUPON_STAGE_LABELS = {
  no_qr: "ยังไม่ได้รับ QR",
  pending: "รอสั่ง",
  cancelled_wait_qr: "ยกเลิก รอออก QR ใหม่",
  forfeited: "ตัดสิทธิ์ (หมดเวลา 15:00)",
  ordered: "สั่งแล้ว",
  at_shop: "ไปสั่งที่ร้าน",
};

// ต่อท้ายป้ายของขั้นที่ยังไม่มีใบ live เมื่อรหัสของใบล่าสุดยังไม่จบ
const CODE_STATE_SUFFIX = {
  awaiting_return: "รอคืนคูปอง",
};

/**
 * @param liveOrder   ใบที่ยังไม่ถูกยกเลิกของ (คลาส, ผู้เรียน, วัน) — ไม่มี = null
 * @param latestOrder ใบล่าสุดของวันนั้น (รวมใบที่ยกเลิก) — ไม่มีเลย = null
 * @param finalClosed ถึงเวลาปิดของวันนั้นแล้ว (finalCloseAt ตาม lunchTimes — เวลาทดสอบใช้ได้)
 */
export function couponStageOf({ liveOrder = null, latestOrder = null, finalClosed = false }) {
  if (liveOrder) {
    if (liveOrder.status === "ordered" || liveOrder.status === "at_shop") return liveOrder.status;
    return finalClosed ? "forfeited" : "pending";
  }
  if (finalClosed) return "forfeited";
  return latestOrder ? "cancelled_wait_qr" : "no_qr";
}

/** ป้ายไทยของขั้น + (ถ้ามี) สถานะรหัสที่ยังต้องตามคืน */
export function couponStageLabel(stage, codeState = null) {
  const base = COUPON_STAGE_LABELS[stage] || "";
  const live = stage === "ordered" || stage === "at_shop" || stage === "pending";
  const suffix = !live && codeState ? CODE_STATE_SUFFIX[codeState] : "";
  return suffix ? `${base} · ${suffix}` : base;
}
