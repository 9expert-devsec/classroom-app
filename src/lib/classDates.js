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
