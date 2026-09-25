// src/lib/classDates.js
//
// Shared "YYYY-MM-DD" helpers for class schedules. Extracted from
// src/app/api/admin/classes/route.js so the admin API and the external API
// derive dates from exactly the same code and can never disagree.

/** True when x looks like "YYYY-MM-DD". */
export function isYMD(x) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(x || "").trim());
}

/** Unique, sorted list of valid YMD strings. Lexicographic sort is correct here. */
export function uniqSortYMD(list) {
  const m = new Map();
  for (const v of Array.isArray(list) ? list : []) {
    const s = String(v || "").trim();
    if (!isYMD(s)) continue;
    m.set(s, true);
  }
  return Array.from(m.keys()).sort();
}

/** "YYYY-MM-DD" -> Date at UTC midnight. */
export function ymdToUTCDate(ymd) {
  const [y, m, d] = String(ymd)
    .split("-")
    .map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** Date -> "YYYY-MM-DD" read in UTC. */
export function utcDateToYMD(dt) {
  if (!dt || Number.isNaN(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** N consecutive days starting at ymdStart. */
export function buildContiguousDaysFromStart(ymdStart, dayCount) {
  const base = ymdToUTCDate(ymdStart);
  if (!base) return [];
  const n = Number(dayCount) || 1;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const dt = new Date(base.getTime() + i * 86400000);
    out.push(utcDateToYMD(dt));
  }
  return out;
}

/* ---------------- Asia/Bangkok wall-clock helpers ---------------- */
//
// Class.days[] are already "YYYY-MM-DD" in Thai local terms, but Event.startAt
// / Event.endAt are instants (UTC). Merging the two into one day-oriented feed
// therefore has to read every instant in Asia/Bangkok, NEVER in UTC and never
// in the server's local zone: an event at 2026-08-04T17:00:00Z is 00:00 on
// 2026-08-05 in Bangkok and belongs on the 5th, not the 4th.
//
// Everything below goes through Intl with timeZone "Asia/Bangkok". No +7 is
// hard-coded anywhere - the offset is asked for, not assumed.

const BANGKOK_TZ = "Asia/Bangkok";

// Runaway guard: a mis-entered endAt years in the future must not turn into a
// multi-thousand-element dates[] in an API response.
const MAX_EVENT_DAYS = 366;

const bangkokParts = new Intl.DateTimeFormat("en-US", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function toDate(x) {
  if (!x) return null;
  const d = x instanceof Date ? x : new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar/clock fields of an instant as seen in Bangkok. */
function bangkokFieldsOf(x) {
  const d = toDate(x);
  if (!d) return null;

  const out = {};
  for (const p of bangkokParts.formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** Date -> "YYYY-MM-DD" as seen in Asia/Bangkok. "" when not a valid date. */
export function bangkokYMD(x) {
  const f = bangkokFieldsOf(x);
  return f ? `${f.year}-${f.month}-${f.day}` : "";
}

/** Date -> "HH:mm" (24h) as seen in Asia/Bangkok. "" when not a valid date. */
export function bangkokHM(x) {
  const f = bangkokFieldsOf(x);
  return f ? `${f.hour}:${f.minute}` : "";
}

/** How far Bangkok wall-clock runs ahead of UTC at this instant, in ms. */
function bangkokOffsetMs(d) {
  const f = bangkokFieldsOf(d);
  if (!f) return 0;
  const asIfUTC = Date.UTC(
    Number(f.year),
    Number(f.month) - 1,
    Number(f.day),
    Number(f.hour),
    Number(f.minute),
    Number(f.second),
  );
  return asIfUTC - d.getTime();
}

/** "YYYY-MM-DD" -> the instant that day begins in Bangkok (00:00:00.000). */
export function bangkokDayStartUTC(ymd) {
  if (!isYMD(ymd)) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);

  // Treat the wall-clock as UTC first, then subtract the zone offset. The
  // offset is re-read at the corrected instant so a zone that changed offset
  // near midnight still lands on the right side of the change.
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  let guess = new Date(wall - bangkokOffsetMs(new Date(wall)));
  guess = new Date(wall - bangkokOffsetMs(guess));
  return guess;
}

/** The next calendar day after a "YYYY-MM-DD", as "YYYY-MM-DD". */
export function nextYMD(ymd) {
  const base = ymdToUTCDate(ymd);
  if (!base) return "";
  return utcDateToYMD(new Date(base.getTime() + 86400000));
}

/** "YYYY-MM-DD" -> the last instant of that day in Bangkok (23:59:59.999). */
export function bangkokDayEndUTC(ymd) {
  const nextStart = bangkokDayStartUTC(nextYMD(ymd));
  return nextStart ? new Date(nextStart.getTime() - 1) : null;
}

/** Today's date in Bangkok, as "YYYY-MM-DD". */
export function bangkokTodayYMD() {
  return bangkokYMD(new Date());
}

/**
 * Every day an event covers, inclusive, in Bangkok terms.
 * A null/invalid/earlier endAt yields a single day.
 */
export function expandEventDays(startAt, endAt) {
  const startYmd = bangkokYMD(startAt);
  if (!startYmd) return [];

  const endYmd = bangkokYMD(endAt);
  if (!endYmd || endYmd <= startYmd) return [startYmd];

  const out = [];
  let cur = ymdToUTCDate(startYmd);
  const last = ymdToUTCDate(endYmd);

  while (cur.getTime() <= last.getTime() && out.length < MAX_EVENT_DAYS) {
    out.push(utcDateToYMD(cur));
    cur = new Date(cur.getTime() + 86400000);
  }

  return out;
}

/* ---------------- Which training day is "today" ---------------- */
//
// Lifted verbatim from src/app/api/checkin/search/route.js so the learner
// check-in search and the Masterclass endpoints resolve "today" through one
// implementation. search/route.js now imports these instead of keeping its
// own copies; the maths is unchanged.
//
// The +07:00 literal below is the original code's. Bangkok has had no DST
// since 1955, so a fixed offset and Intl agree; date->YMD still goes through
// bangkokYMD, which asks Intl for the zone rather than assuming it.

const BKK_TZ_OFFSET = "+07:00";

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** base YMD + addDays -> YMD (Bangkok). */
export function addDaysYMD_BKK(ymd, addDays) {
  if (!ymd) return "";
  const base = new Date(`${ymd}T00:00:00${BKK_TZ_OFFSET}`);
  if (!isValidDate(base)) return "";
  base.setDate(base.getDate() + Number(addDays || 0));
  return bangkokYMD(base);
}

/** end - start, in whole Bangkok calendar days. */
export function diffDaysYMD_BKK(startYMD, endYMD) {
  const a = new Date(`${startYMD}T00:00:00${BKK_TZ_OFFSET}`);
  const b = new Date(`${endYMD}T00:00:00${BKK_TZ_OFFSET}`);
  if (!isValidDate(a) || !isValidDate(b)) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

/** dayCount of a Class doc: top-level first, then duration.dayCount, else 1. */
export function getDayCountFromClassDoc(c) {
  return typeof c?.dayCount === "number"
    ? c.dayCount
    : typeof c?.duration?.dayCount === "number"
      ? c.duration.dayCount
      : 1;
}

/**
 * 1-based index of todayYMD within a class's training days, or null when
 * today is not a training day.
 *
 * days[] wins when present (it is the source of truth and may skip days);
 * otherwise fall back to date + dayCount as a contiguous range.
 */
export function computeDayIndexToday(c, todayYMD) {
  if (!c) return null;

  if (Array.isArray(c.days) && c.days.length) {
    const idx = c.days.findIndex((d) => String(d || "") === todayYMD);
    if (idx >= 0) return idx + 1; // 1-based
    return null;
  }

  if (!c.date) return null;
  const dayCount = getDayCountFromClassDoc(c);
  const startYMD = bangkokYMD(c.date);
  if (!startYMD) return null;

  const endYMD = addDaysYMD_BKK(startYMD, dayCount - 1);
  if (!endYMD) return null;

  if (!(todayYMD >= startYMD && todayYMD <= endYMD)) return null;

  const dayToday = diffDaysYMD_BKK(startYMD, todayYMD) + 1;
  return Math.min(Math.max(dayToday, 1), dayCount);
}

/**
 * The ONE answer to "which training day of this class is today?" for the
 * check-in flow, the food/check-in APIs and the lunch-token check.
 * Today is read in Asia/Bangkok on the server, never from a device clock.
 * Returns a 1-based index, or null when today is not a training day.
 * The class doc needs date, days and dayCount/duration.dayCount.
 */
export function classDayIndexToday(c, now = new Date()) {
  return computeDayIndexToday(c, bangkokYMD(now));
}

/**
 * "Checked in today" for a Checkin row already matched on (student, class,
 * classDayIndexToday): its time - rewritten by /api/checkin/complete on every
 * check-in - must fall on today's Bangkok date. Guards against a row with the
 * same day index written on another date (complete falls back to the posted
 * day when today is not a class day). A row without time never counts.
 * Shared by the lunch-token check and the edit-user search (L2b/L2c).
 */
export function isCheckinToday(checkin, now = new Date()) {
  if (!checkin?.time) return false;
  const at = bangkokYMD(checkin.time);
  return !!at && at === bangkokYMD(now);
}

/** "YYYY-MM-DD" of training day N (1-based): days[] first, else date + (N-1) in Bangkok. */
export function classDayYMD(c, day) {
  const n = Math.max(1, Number(day) || 1);
  if (Array.isArray(c?.days) && c.days[n - 1]) {
    return String(c.days[n - 1]).slice(0, 10);
  }
  const startYMD = bangkokYMD(c?.date);
  return startYMD ? addDaysYMD_BKK(startYMD, n - 1) : "";
}
