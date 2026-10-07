// src/app/m/[key]/[restaurantId]/report/reportFormat.js
//
// C4: รูปแบบวันเวลาของหน้าสรุป Merchant (อังกฤษ เวลาไทยเสมอ) ใช้ร่วมกับหน้า preview
// ช่วงเวลาจริงคิดที่ server — ฝั่งนี้แค่แสดงผล

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export function rangeKeyOf(raw) {
  return RANGES.some((r) => r.key === raw) ? raw : "today";
}

const TZ = "Asia/Bangkok";

function parts(iso, opts) {
  const out = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).formatToParts(
    new Date(iso),
  )) {
    out[p.type] = p.value;
  }
  return out;
}

/** HH:mm */
export function fmtTime(iso) {
  const p = parts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** Today -> "HH:mm", week/month -> "DD MMM HH:mm" */
export function fmtRowTime(iso, rangeKey) {
  if (!iso) return "";
  if (rangeKey === "today") return fmtTime(iso);
  const p = parts(iso, { day: "2-digit", month: "short" });
  return `${p.day} ${p.month} ${fmtTime(iso)}`;
}

function ymdDate(ymd) {
  return `${ymd}T12:00:00+07:00`;
}

/** "7 Oct 2026" */
export function fmtDay(ymd) {
  const p = parts(ymdDate(ymd), { day: "numeric", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}

/** "Wed 7 Oct" */
export function fmtDayShort(ymd) {
  const p = parts(ymdDate(ymd), { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** Today -> "7 Oct 2026", ช่วง -> "5 Oct – 11 Oct 2026" */
export function fmtRangeDates(range) {
  if (!range?.fromYMD) return "";
  if (range.fromYMD === range.toYMD) return fmtDay(range.fromYMD);
  const a = parts(ymdDate(range.fromYMD), { day: "numeric", month: "short", year: "numeric" });
  const b = parts(ymdDate(range.toYMD), { day: "numeric", month: "short", year: "numeric" });
  return a.year === b.year
    ? `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`
    : `${fmtDay(range.fromYMD)} – ${fmtDay(range.toYMD)}`;
}

/** "07 Oct 2026, 11:32" */
export function fmtAsOf(iso) {
  const p = parts(iso, { day: "2-digit", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}, ${fmtTime(iso)}`;
}

/** "20261007-1132" สำหรับชื่อไฟล์ */
export function fmtStamp(iso) {
  const p = parts(iso, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}
