// src/lib/lunchConfig.js
// ค่าคงที่ + helper วัน/เวลา (Asia/Bangkok) ของระบบ pre-order อาหารกลางวัน
// ไฟล์นี้ใช้ได้ทั้ง client และ server — ห้าม import อะไรที่เป็น Node-only

export const LUNCH_BUDGET_THB = 180;

// สั่งแบบเต็ม (มีเมนู): นับถอยหลังตั้งแต่ 11:00 แล้วปิดจริง 11:15 (เวลาไทย)
export const ORDER_SOFT_CLOSE_HHMM = "11:00";
export const ORDER_HARD_CLOSE_HHMM = "11:15";

// C1: หลังเส้นตายยังสั่งแบบย่อ (at_shop) ได้ถึง 15:00 — 15:00 ปิดทุกสถานะ
//     ยังไม่ได้สั่งเมื่อถึง 15:00 = ตัดสิทธิ์ (forfeited)
export const FINAL_CLOSE_HHMM = "15:00";

// Counter ยกเลิก + ออก QR ใหม่ให้คนที่สั่งไปแล้ว: ได้อีก 10 นาที (ไม่เกิน 15:00)
export const SPECIAL_REOPEN_MINUTES = 10;

// P4b: แจ้งเตือน "คูปองร้าน X เหลือ N ใบ" เมื่อเหลือไม่เกินค่านี้
// (ใช้เมื่อ Restaurant.couponStockLowThreshold ไม่ได้ตั้งไว้)
export const LUNCH_STOCK_LOW_DEFAULT = 5;

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

export function isValidNickname(s) {
  const v = String(s ?? "").trim();
  return NICKNAME_REGEX.test(v);
}

/* ---------------- C2d: เวลาปิดสำหรับทดสอบ (preview / dev เท่านั้น) ---------------- */
//
// ทีมทดสอบช่วงบ่ายบน Vercel Preview / เครื่อง dev ได้โดยเลื่อนเวลาปิดผ่าน env:
//   LUNCH_TEST_SOFT_CLOSE (11:00) / LUNCH_TEST_HARD_CLOSE (11:15) / LUNCH_TEST_FINAL_CLOSE (15:00)
// อ่านเฉพาะเมื่อ VERCEL_ENV === "preview" หรือ NODE_ENV === "development"
// production (VERCEL_ENV === "production" หรือ NODE_ENV อื่น) ไม่อ่านเลยแม้ตั้งไว้
// ค่าไม่ถูกต้อง (ไม่ใช่ HH:MM หรือไม่เรียง soft < hard < final) -> warn ครั้งเดียว
// แล้วใช้ค่าปกติทั้ง 3 ตัว ไม่ผสมกัน
//
// ทุกการตัดสินเรื่องเวลาปิดต้องผ่าน lunchTimes() ตัวเดียว — ห้ามอ่าน env หรือค่าคงที่ข้างบนตรง ๆ
// ฝั่ง browser ไม่มี env เหล่านี้ (ไม่ใช่ NEXT_PUBLIC_) จึงได้ค่าปกติเสมอ — client วาดตามผลของ server

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmmToMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
let warnedInvalidKey = "";

export function lunchTimes() {
  const defaults = {
    soft: ORDER_SOFT_CLOSE_HHMM,
    hard: ORDER_HARD_CLOSE_HHMM,
    final: FINAL_CLOSE_HHMM,
    overridden: false,
  };
  if (typeof process === "undefined" || !process.env) return defaults;

  const vercelEnv = process.env.VERCEL_ENV;
  const allowed =
    vercelEnv !== "production" &&
    (vercelEnv === "preview" || process.env.NODE_ENV === "development");
  if (!allowed) return defaults;

  const raw = {
    soft: String(process.env.LUNCH_TEST_SOFT_CLOSE || "").trim(),
    hard: String(process.env.LUNCH_TEST_HARD_CLOSE || "").trim(),
    final: String(process.env.LUNCH_TEST_FINAL_CLOSE || "").trim(),
  };
  if (!raw.soft && !raw.hard && !raw.final) return defaults;

  const t = {
    soft: raw.soft || defaults.soft,
    hard: raw.hard || defaults.hard,
    final: raw.final || defaults.final,
  };
  const valid =
    HHMM_RE.test(t.soft) &&
    HHMM_RE.test(t.hard) &&
    HHMM_RE.test(t.final) &&
    hhmmToMin(t.soft) < hhmmToMin(t.hard) &&
    hhmmToMin(t.hard) < hhmmToMin(t.final);

  if (!valid) {
    const key = `${raw.soft}|${raw.hard}|${raw.final}`;
    if (warnedInvalidKey !== key) {
      warnedInvalidKey = key;
      console.warn(
        `[lunchConfig] LUNCH_TEST_* ไม่ถูกต้อง (soft=${raw.soft || "-"} hard=${raw.hard || "-"} final=${raw.final || "-"}) — ใช้ค่าปกติ ${defaults.soft}/${defaults.hard}/${defaults.final}`,
      );
    }
    return defaults;
  }

  return { ...t, overridden: true };
}

/** "TEST TIMES: 16:45–17:00–23:00" เมื่อมีการ override, "" เมื่อไม่มี */
export function lunchTestTimesLabel() {
  const t = lunchTimes();
  return t.overridden ? `TEST TIMES: ${t.soft}–${t.hard}–${t.final}` : "";
}

/* ---------------- หน้าต่างเวลาสั่งอาหาร ---------------- */
//
// ฟังก์ชันด้านล่างเป็น pure ทั้งหมดและรับ `now` เข้ามาได้ เพื่อให้ทดสอบได้
// โดยไม่ต้องแกล้งนาฬิกาเครื่อง — server เป็นเจ้าของเวลาแต่ผู้เดียว
// client แค่วาดตามผลลัพธ์ของ orderWindow() ไม่คำนวณเองซ้ำ
//
// P3b-0: P1a กับ P3a เคยมีฟังก์ชันคำนวณเรื่องเดียวกันคนละชุด ตอนนี้เหลือ
// implementation เดียวต่อหนึ่งการคำนวณ (ยึดความหมายของ P3a ที่ verify แล้ว)
// ชื่อเดิมจาก P1a ยังอยู่แต่เป็นแค่ alias บาง ๆ ไม่มีสูตรซ้ำอีก

// นาทีก่อนหมดเวลาที่เริ่มนับถอยหลัง (ใช้กับ deadline ที่ถูกเลื่อนออกไปด้วย)
export const CLOSING_SOON_MINUTES = 15;

/**
 * "YYYY-MM-DD" + "HH:MM" (เวลาไทย) -> Date
 * ไทยเป็น +07:00 ตลอดปี ไม่มี DST จึง fix offset ได้ตรง ๆ
 * ตัวจริงตัวเดียวที่แปลง wall-clock ไทยเป็น Date
 */
export function bkkAt(dayYMD, hhmm) {
  const d = new Date(`${dayYMD}T${hhmm}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** alias เดิมจาก P1a */
export function bkkDateTime(ymd, hhmm) {
  return bkkAt(ymd, hhmm);
}

/** เส้นตายปกติของวันนั้น = 11:15 เวลาไทย (C2d: ผ่าน lunchTimes) */
export function defaultDeadline(dayYMD) {
  return bkkAt(dayYMD, lunchTimes().hard);
}

/** C2d: จุดเริ่มนับถอยหลัง = 11:00 เวลาไทย (ผ่าน lunchTimes) */
export function softCloseAt(dayYMD) {
  return bkkAt(dayYMD, lunchTimes().soft);
}

/** C1: ปิดทุกสถานะของวันนั้น = 15:00 เวลาไทย */
export function finalCloseAt(dayYMD) {
  return bkkAt(dayYMD, lunchTimes().final);
}

/**
 * C2: หลัง 15:00 ของวันนั้นปิดเรื่องคูปองทั้งหมด — แท็บเล็ตไม่เสนอ Cash Coupon,
 * บันทึก choiceType "coupon" ไม่ได้ และไม่ออก QR สั่งอาหาร
 */
export function isCouponClosed(dayYMD, now = new Date()) {
  const fc = finalCloseAt(dayYMD);
  return !!fc && new Date(now).getTime() >= fc.getTime();
}

/**
 * ออก QR ใหม่ให้รายคน = min(max(11:15, now + 10 นาที), 15:00)
 * ได้อย่างน้อย SPECIAL_REOPEN_MINUTES นาที ไม่สั้นกว่าเวลาปิดปกติ และไม่เกิน 15:00
 */
export function reissueDeadline(dayYMD, now = new Date()) {
  const hardCloseAt = defaultDeadline(dayYMD);
  const finalClose = finalCloseAt(dayYMD);
  let deadline = new Date(
    new Date(now).getTime() + SPECIAL_REOPEN_MINUTES * 60 * 1000,
  );
  if (hardCloseAt && hardCloseAt > deadline) deadline = hardCloseAt;
  if (finalClose && deadline > finalClose) deadline = finalClose;
  return deadline;
}

/** alias เดิมจาก P1a */
export function computeReopenDeadline(ymd, now = new Date()) {
  return reissueDeadline(ymd, now);
}

/** alias เดิมจาก P1a — คืนแค่จุดเริ่มนับถอยหลังกับเส้นตายปกติ */
export function getOrderWindow(ymd) {
  return {
    softCloseAt: softCloseAt(ymd),
    hardCloseAt: defaultDeadline(ymd),
  };
}

/**
 * สถานะหน้าต่างเวลาของออเดอร์หนึ่งใบ
 *   expired : ถึง 15:00 ของวันนั้นแล้ว — ปิดทุกสถานะ
 *   short   : เลย deadline แล้วแต่ยังไม่ถึง 15:00 — สั่งแบบย่อ (at_shop) ได้เท่านั้น
 *   closing : ถึง 11:00 ของวันนั้นแล้ว หรือเหลือ <= 15 นาทีก่อน deadline
 *   open    : นอกนั้น
 * deadlineAt ที่ส่งเข้ามาชนะเสมอ (เคสที่ Counter ออก QR ใหม่ให้รายคน)
 */
export function orderWindow({ dayYMD, deadlineAt }, now = new Date()) {
  const nowMs = new Date(now).getTime();

  const deadline = deadlineAt ? new Date(deadlineAt) : defaultDeadline(dayYMD);
  const countdownFrom = softCloseAt(dayYMD);
  const finalClose = finalCloseAt(dayYMD);

  const deadlineMs = deadline ? deadline.getTime() : NaN;
  const msLeft = Number.isNaN(deadlineMs) ? 0 : deadlineMs - nowMs;
  const secondsLeft = Math.max(0, Math.floor(msLeft / 1000));

  const finalMs = finalClose ? finalClose.getTime() : NaN;
  const secondsToFinalClose = Number.isNaN(finalMs)
    ? 0
    : Math.max(0, Math.floor((finalMs - nowMs) / 1000));

  let phase;
  if (!Number.isNaN(finalMs) && nowMs >= finalMs) {
    phase = "expired";
  } else if (!Number.isNaN(deadlineMs) && nowMs >= deadlineMs) {
    phase = "short";
  } else if (
    (countdownFrom && nowMs >= countdownFrom.getTime()) ||
    msLeft <= CLOSING_SOON_MINUTES * 60 * 1000
  ) {
    phase = "closing";
  } else {
    phase = "open";
  }

  return {
    phase,
    deadlineAt: deadline,
    countdownFrom,
    secondsLeft,
    finalCloseAt: finalClose,
    secondsToFinalClose,
  };
}
