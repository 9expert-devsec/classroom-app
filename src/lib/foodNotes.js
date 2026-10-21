// src/lib/foodNotes.js
// R1: โน้ตอัตโนมัติของ Student.food ("COUPON" / "ไม่รับอาหาร") — ใช้ได้ทั้ง client และ server
// ระบบเติมให้เองตามตัวเลือก ไม่ใช่สิ่งที่ผู้เรียน/เจ้าหน้าที่พิมพ์ จึงต้องไม่ติดไปกับตัวเลือกอื่น

export const AUTO_FOOD_NOTES = ["COUPON", "ไม่รับอาหาร"];

const AUTO_LOWER = new Set(AUTO_FOOD_NOTES.map((s) => s.toLowerCase()));

/** true = โน้ตนี้เป็นโน้ตอัตโนมัติ (ไม่สนตัวพิมพ์เล็ก-ใหญ่ / ช่องว่างหัวท้าย) */
export function isAutoNote(note) {
  return AUTO_LOWER.has(String(note ?? "").trim().toLowerCase());
}

/**
 * โน้ตที่ user พิมพ์เอง — โน้ตอัตโนมัติกลายเป็น ""
 * R2b: รูปแบบเดิมที่ server เคยเขียน (52ddaa7 -> a85f70f, api/checkin/food) คือ "ทั้งโน้ต"
 *      = "COUPON" หรือ "ไม่รับอาหาร" เมื่อคนไม่ได้พิมพ์อะไร (note: safeNote || "COUPON")
 *      ไม่เคยต่อท้ายข้อความที่คนพิมพ์ จึงตัดเฉพาะเมื่อทั้งโน้ตตรงเท่านั้น
 *      ข้อความที่คนพิมพ์ (แม้มีคำว่า COUPON อยู่ข้างใน) ไม่ถูกแตะ · ไม่แก้ข้อมูลใน DB
 */
export function stripAutoNote(note) {
  const s = String(note ?? "").trim();
  return isAutoNote(s) ? "" : s;
}

/** ชื่อที่ใช้ในหน้า Food Report (ตัวเดียวกับ stripAutoNote) */
export const stripAutoFoodNote = stripAutoNote;
