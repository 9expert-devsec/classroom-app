// src/lib/lunchConfig.js
// ค่าคงที่ + helper วัน/เวลา (Asia/Bangkok) ของระบบ pre-order อาหารกลางวัน
// ไฟล์นี้ใช้ได้ทั้ง client และ server — ห้าม import อะไรที่เป็น Node-only

export const LUNCH_BUDGET_THB = 180;

// ปิดรับออเดอร์: นับถอยหลังตั้งแต่ 11:00 แล้วปิดจริง 11:15 (เวลาไทย)
export const ORDER_SOFT_CLOSE_HHMM = "11:00";
export const ORDER_HARD_CLOSE_HHMM = "11:15";

// admin เปิดให้เป็นรายคนได้อีก 10 นาที
export const SPECIAL_REOPEN_MINUTES = 10;

// ชื่อเล่นบนคูปอง: อังกฤษล้วน ไม่เกิน 20 ตัวอักษร
export const NICKNAME_MAX = 20;
export const NICKNAME_REGEX = /^[A-Za-z][A-Za-z ]{0,19}$/;

export const BKK_TZ = "Asia/Bangkok";

// วันแบบ "YYYY-MM-DD" ตามเวลาไทย
// ใช้ Intl อย่างเดียว — ห้าม new Date(x.toLocaleString(...)) เพราะ string
// จะถูก parse ซ้ำด้วย timezone ของ server (UTC บน production) แล้วเพี้ยนไป 1 วัน
export function toBkkYMD(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// "YYYY-MM-DD" + "HH:mm" (เวลาไทย) -> Date
// ไทยเป็น +07:00 ตลอดปี ไม่มี DST จึง fix offset ได้ตรง ๆ
export function bkkDateTime(ymd, hhmm) {
  const d = new Date(`${ymd}T${hhmm}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ช่วงเวลารับออเดอร์ของวันนั้น
export function getOrderWindow(ymd) {
  return {
    softCloseAt: bkkDateTime(ymd, ORDER_SOFT_CLOSE_HHMM),
    hardCloseAt: bkkDateTime(ymd, ORDER_HARD_CLOSE_HHMM),
  };
}

// เปิดพิเศษรายคน: ได้อย่างน้อย SPECIAL_REOPEN_MINUTES นาทีเสมอ
// (ถ้ายังไม่ถึงเวลาปิด ก็ไม่ควรสั้นกว่าเวลาปิดปกติ)
export function computeReopenDeadline(ymd, now = new Date()) {
  const { hardCloseAt } = getOrderWindow(ymd);
  const extended = new Date(
    new Date(now).getTime() + SPECIAL_REOPEN_MINUTES * 60 * 1000,
  );
  if (!hardCloseAt) return extended;
  return extended > hardCloseAt ? extended : hardCloseAt;
}

export function isValidNickname(s) {
  const v = String(s ?? "").trim();
  return NICKNAME_REGEX.test(v);
}
