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

/* ---------------- P3a: หน้าต่างเวลาสั่งอาหาร ---------------- */
//
// ฟังก์ชันด้านล่างเป็น pure ทั้งหมดและรับ `now` เข้ามาได้ เพื่อให้ทดสอบได้
// โดยไม่ต้องแกล้งนาฬิกาเครื่อง — server เป็นเจ้าของเวลาแต่ผู้เดียว
// client แค่วาดตามผลลัพธ์ของ orderWindow() ไม่คำนวณเองซ้ำ

// นาทีก่อนหมดเวลาที่เริ่มนับถอยหลัง (ใช้กับ deadline ที่ถูกเลื่อนออกไปด้วย)
export const CLOSING_SOON_MINUTES = 15;

/** "YYYY-MM-DD" + "HH:MM" (เวลาไทย) -> Date */
export function bkkAt(dayYMD, hhmm) {
  return bkkDateTime(dayYMD, hhmm);
}

/** เส้นตายปกติของวันนั้น = 11:15 เวลาไทย */
export function defaultDeadline(dayYMD) {
  return bkkAt(dayYMD, ORDER_HARD_CLOSE_HHMM);
}

/**
 * ออก QR ใหม่ให้รายคน: ได้เวลาอย่างน้อย SPECIAL_REOPEN_MINUTES นาทีเสมอ
 * แต่ถ้ายังไม่ถึงเวลาปิดปกติ ก็ไม่ควรสั้นกว่านั้น
 */
export function reissueDeadline(dayYMD, now = new Date()) {
  return computeReopenDeadline(dayYMD, now);
}

/**
 * สถานะหน้าต่างเวลาของออเดอร์หนึ่งใบ
 *   closed  : เลย deadline แล้ว
 *   closing : ถึง 11:00 ของวันนั้นแล้ว หรือเหลือ <= 15 นาทีก่อน deadline
 *   open    : นอกนั้น
 * deadlineAt ที่ส่งเข้ามาชนะเสมอ (เคสที่ admin เลื่อนให้รายคน)
 */
export function orderWindow({ dayYMD, deadlineAt }, now = new Date()) {
  const nowMs = new Date(now).getTime();

  const deadline = deadlineAt ? new Date(deadlineAt) : defaultDeadline(dayYMD);
  const countdownFrom = bkkAt(dayYMD, ORDER_SOFT_CLOSE_HHMM);

  const deadlineMs = deadline ? deadline.getTime() : NaN;
  const msLeft = Number.isNaN(deadlineMs) ? 0 : deadlineMs - nowMs;
  const secondsLeft = Math.max(0, Math.floor(msLeft / 1000));

  let phase;
  if (!Number.isNaN(deadlineMs) && nowMs >= deadlineMs) {
    phase = "closed";
  } else if (
    (countdownFrom && nowMs >= countdownFrom.getTime()) ||
    msLeft <= CLOSING_SOON_MINUTES * 60 * 1000
  ) {
    phase = "closing";
  } else {
    phase = "open";
  }

  return { phase, deadlineAt: deadline, countdownFrom, secondsLeft };
}
